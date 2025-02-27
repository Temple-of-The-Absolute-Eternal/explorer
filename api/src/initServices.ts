
import { MqttClient } from "@iota/iota.js";
import { ServiceFactory } from "./factories/serviceFactory";
import { IConfiguration } from "./models/configuration/IConfiguration";
import { ICurrencyState } from "./models/db/ICurrencyState";
import { IMarket } from "./models/db/IMarket";
import { IMilestoneStore } from "./models/db/IMilestoneStore";
import { INetwork } from "./models/db/INetwork";
import { IFeedService } from "./models/services/IFeedService";
import { IItemsService } from "./models/services/IItemsService";
import { AmazonDynamoDbService } from "./services/amazonDynamoDbService";
import { ChrysalisFeedService } from "./services/chrysalisFeedService";
import { ChrysalisItemsService } from "./services/chrysalisItemsService";
import { CurrencyService } from "./services/currencyService";
import { LocalStorageService } from "./services/localStorageService";
import { MilestonesService } from "./services/milestonesService";
import { NetworkService } from "./services/networkService";
import { OgFeedService } from "./services/ogFeedService";
import { OgItemsService } from "./services/ogItemsService";
import { ZmqService } from "./services/zmqService";

/**
 * Initialise all the services for the workers.
 * @param config The configuration to initialisation the service with.
 */
export async function initServices(config: IConfiguration) {
    registerStorageServices(config);

    const networkService = new NetworkService();
    ServiceFactory.register("network", () => networkService);

    await networkService.buildCache();

    const networks = await networkService.networks();

    const enabledNetworks = networks.filter(v => v.isEnabled);

    for (const networkConfig of enabledNetworks) {
        if (networkConfig.protocolVersion === "og") {
            if (networkConfig.feedEndpoint) {
                ServiceFactory.register(
                    `zmq-${networkConfig.network}`, () => new ZmqService(
                        networkConfig.feedEndpoint, [
                        "trytes",
                        "sn",
                        networkConfig.coordinatorAddress
                    ])
                );

                ServiceFactory.register(
                    `feed-${networkConfig.network}`, () => new OgFeedService(
                        networkConfig.network, networkConfig.coordinatorAddress)
                );

                ServiceFactory.register(
                    `items-${networkConfig.network}`,
                    () => new OgItemsService(networkConfig.network));
            }
        } else if (networkConfig.protocolVersion === "chrysalis" && networkConfig.feedEndpoint) {
            ServiceFactory.register(
                `mqtt-${networkConfig.network}`, () => new MqttClient(
                    networkConfig.feedEndpoint.split(";"))
            );

            ServiceFactory.register(
                `feed-${networkConfig.network}`, () => new ChrysalisFeedService(
                    networkConfig.network, networkConfig.provider, networkConfig.user, networkConfig.password)
            );

            ServiceFactory.register(
                `items-${networkConfig.network}`,
                () => new ChrysalisItemsService(networkConfig.network));
        }

        if ((networkConfig.protocolVersion === "og" || networkConfig.protocolVersion === "chrysalis") &&
            networkConfig.feedEndpoint) {
            ServiceFactory.register(
                `milestones-${networkConfig.network}`,
                () => new MilestonesService(networkConfig.network));
        }
    }

    for (const networkConfig of enabledNetworks) {
        if (networkConfig.protocolVersion === "og") {
            const zmqService = ServiceFactory.get<ZmqService>(`zmq-${networkConfig.network}`);
            if (zmqService) {
                zmqService.connect();
            }
        }

        if (networkConfig.protocolVersion === "og" || networkConfig.protocolVersion === "chrysalis") {
            const milestonesService = ServiceFactory.get<MilestonesService>(`milestones-${networkConfig.network}`);
            if (milestonesService) {
                await milestonesService.init();
            }
        }

        if (networkConfig.protocolVersion === "og" || networkConfig.protocolVersion === "chrysalis") {
            const itemsService = ServiceFactory.get<IItemsService>(
                `items-${networkConfig.network}`);

            if (itemsService) {
                itemsService.init();
            }
        }

        if (networkConfig.protocolVersion === "og" || networkConfig.protocolVersion === "chrysalis") {
            const feedService = ServiceFactory.get<IFeedService>(`feed-${networkConfig.network}`);
            if (feedService) {
                feedService.connect();
            }
        }
    }

    const update = async () => {
        const currencyService = new CurrencyService(config);
        const log = await currencyService.update();
        console.log(log);
    };

    setInterval(
        update,
        60000);

    await update();
}

/**
 * Register the storage services.
 * @param config The config.
 */
function registerStorageServices(config: IConfiguration): void {
    if (config.rootStorageFolder) {
        ServiceFactory.register("network-storage", () => new LocalStorageService<INetwork>(
            config.rootStorageFolder, "network", "network"));

        ServiceFactory.register("milestone-storage", () => new LocalStorageService<IMilestoneStore>(
            config.rootStorageFolder, "milestones", "network"));

        ServiceFactory.register("currency-storage", () => new LocalStorageService<ICurrencyState>(
            config.rootStorageFolder, "currency", "id"));

        ServiceFactory.register("market-storage", () => new LocalStorageService<IMarket>(
            config.rootStorageFolder, "market", "currency"));
    } else if (config.dynamoDbConnection) {
        ServiceFactory.register("network-storage", () => new AmazonDynamoDbService<IMarket>(
            config.dynamoDbConnection, "network", "network"));

        ServiceFactory.register("milestone-storage", () => new AmazonDynamoDbService<IMilestoneStore>(
            config.dynamoDbConnection, "milestones", "network"));

        ServiceFactory.register("currency-storage", () => new AmazonDynamoDbService<ICurrencyState>(
            config.dynamoDbConnection, "currency", "id"));

        ServiceFactory.register("market-storage", () => new AmazonDynamoDbService<IMarket>(
            config.dynamoDbConnection, "market", "currency"));
    }
}
