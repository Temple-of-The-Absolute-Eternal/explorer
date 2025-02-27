import { IOutputResponse, UnitsHelper } from "@iota/iota.js";
import React, { ReactNode } from "react";
import { Link, RouteComponentProps } from "react-router-dom";
import { ServiceFactory } from "../../../factories/serviceFactory";
import { Bech32AddressHelper } from "../../../helpers/bech32AddressHelper";
import { ClipboardHelper } from "../../../helpers/clipboardHelper";
import { NetworkService } from "../../../services/networkService";
import { SettingsService } from "../../../services/settingsService";
import { TangleCacheService } from "../../../services/tangleCacheService";
import AsyncComponent from "../../components/AsyncComponent";
import Bech32Address from "../../components/chrysalis/Bech32Address";
import Output from "../../components/chrysalis/Output";
import CurrencyButton from "../../components/CurrencyButton";
import MessageButton from "../../components/MessageButton";
import SidePanel from "../../components/SidePanel";
import Spinner from "../../components/Spinner";
import ToolsPanel from "../../components/ToolsPanel";
import ValueButton from "../../components/ValueButton";
import "./Addr.scss";
import { AddrRouteProps } from "./AddrRouteProps";
import { AddrState } from "./AddrState";

/**
 * Component which will show the address page.
 */
class Addr extends AsyncComponent<RouteComponentProps<AddrRouteProps>, AddrState> {
    /**
     * API Client for tangle requests.
     */
    private readonly _tangleCacheService: TangleCacheService;

    /**
     * Settings service.
     */
    private readonly _settingsService: SettingsService;

    /**
     * The hrp of bech addresses.
     */
    private readonly _bechHrp: string;

    /**
     * Create a new instance of Addr.
     * @param props The props.
     */
    constructor(props: RouteComponentProps<AddrRouteProps>) {
        super(props);

        this._tangleCacheService = ServiceFactory.get<TangleCacheService>("tangle-cache");
        this._settingsService = ServiceFactory.get<SettingsService>("settings");

        const networkService = ServiceFactory.get<NetworkService>("network");
        const networkConfig = this.props.match.params.network
            ? networkService.get(this.props.match.params.network)
            : undefined;

        this._bechHrp = networkConfig?.bechHrp ?? "iot";

        const isAdvanced = this._settingsService.get().advancedMode ?? false;

        this.state = {
            ...Bech32AddressHelper.buildAddress(
                this._bechHrp,
                props.match.params.address
            ),
            formatFull: false,
            statusBusy: true,
            status: `Loading ${isAdvanced ? "outputs" : "balances"}...`,
            advancedMode: isAdvanced
        };
    }

    /**
     * The component mounted.
     */
    public async componentDidMount(): Promise<void> {
        super.componentDidMount();

        const result = await this._tangleCacheService.search(
            this.props.match.params.network, this.props.match.params.address);

        if (result?.address) {
            window.scrollTo({
                left: 0,
                top: 0,
                behavior: "smooth"
            });

            this.setState({
                address: result.address,
                bech32AddressDetails: Bech32AddressHelper.buildAddress(
                    this._bechHrp,
                    result.address.address,
                    result.address.addressType
                ),
                balance: result.address.balance,
                outputIds: result.addressOutputIds
            }, async () => {
                const outputs: IOutputResponse[] = [];

                if (result.addressOutputIds) {
                    for (const outputId of result.addressOutputIds) {
                        const outputResult = await this._tangleCacheService.outputDetails(
                            this.props.match.params.network, outputId);

                        if (outputResult) {
                            outputs.push(outputResult);

                            this.setState({
                                outputs,
                                status: `Loading ${this.state.advancedMode
                                    ? "Outputs" : "Balances"} [${outputs.length}/${result.addressOutputIds.length}]`
                            });
                        }

                        if (!this._isMounted) {
                            break;
                        }
                    }
                }

                this.setState({
                    outputs,
                    status: "",
                    statusBusy: false
                });
            });
        } else {
            this.props.history.replace(`/${this.props.match.params.network}/search/${this.props.match.params.address}`);
        }
    }

    /**
     * Render the component.
     * @returns The node to render.
     */
    public render(): ReactNode {
        return (
            <div className="addr">
                <div className="wrapper">
                    <div className="inner">
                        <h1>
                            Address
                        </h1>
                        <div className="row top">
                            <div className="cards">
                                <div className="card">
                                    <div className="card--header card--header__space-between">
                                        <h2>
                                            General
                                        </h2>
                                    </div>
                                    <div className="card--content">
                                        <Bech32Address
                                            addressDetails={this.state.bech32AddressDetails}
                                            advancedMode={this.state.advancedMode}
                                        />
                                        {this.state.balance !== undefined && this.state.balance !== 0 && (
                                            <div className="row fill margin-t-s margin-b-s value-buttons">
                                                <div className="col">
                                                    <ValueButton value={this.state.balance ?? 0} label="Balance" />
                                                </div>
                                                <div className="col">
                                                    <CurrencyButton
                                                        marketsRoute={`/${this.props.match.params.network}/markets`}
                                                        value={this.state.balance ?? 0}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {this.state.balance !== undefined && this.state.balance === 0 && (
                                            <div>
                                                <div className="card--label">
                                                    Balance
                                                </div>
                                                <div className="card--value">
                                                    0
                                                </div>
                                            </div>
                                        )}
                                        {this.state.status && (
                                            <div className="middle row">
                                                {this.state.statusBusy && (<Spinner />)}
                                                <p className="status">
                                                    {this.state.status}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {this.state.outputs && this.state.outputs.length === 0 && (
                                    <div className="card">
                                        <div className="card--content">
                                            <p>
                                                There are no {this.state.advancedMode
                                                    ? "outputs" : "balances"} for this address.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {this.state.advancedMode &&
                                    this.state.outputs &&
                                    this.state.outputIds &&
                                    this.state.outputs.length > 0 &&
                                    this.state.outputs.map((output, idx) => (
                                        <div className="card" key={idx}>
                                            <Output
                                                key={idx}
                                                index={idx + 1}
                                                network={this.props.match.params.network}
                                                history={this.props.history}
                                                id={this.state.outputIds ? this.state.outputIds[idx] : ""}
                                                output={output}
                                                advancedMode={this.state.advancedMode}
                                            />
                                        </div>
                                    ))}
                                {!this.state.advancedMode &&
                                    this.state.outputs &&
                                    this.state.outputIds &&
                                    this.state.outputs.length > 0 && (
                                        <div className="card">
                                            <div className="card--header card--header__space-between">
                                                <h2>
                                                    Balances
                                                </h2>
                                            </div>
                                            <div className="card--content">
                                                {this.state.outputs.map((output, idx) => (
                                                    <div key={idx} className="margin-b-m">
                                                        <div className="card--value row middle">
                                                            <div
                                                                className="
                                                                card--label card--label__no-height margin-r-s"
                                                            >
                                                                Message
                                                            </div>
                                                            <span className="card--value card--value__no-margin">
                                                                <Link
                                                                    to={
                                                                        `/${this.props.match.params.network
                                                                        }/message/${output.messageId}`
                                                                    }
                                                                    className="margin-r-t"
                                                                >
                                                                    {output.messageId}
                                                                </Link>
                                                            </span>
                                                            <MessageButton
                                                                onClick={() => ClipboardHelper.copy(
                                                                    output.messageId
                                                                )}
                                                                buttonType="copy"
                                                                labelPosition="top"
                                                            />
                                                        </div>
                                                        <div className="card--value row middle">
                                                            <div
                                                                className="
                                                                card--label card--label__no-height margin-r-s"
                                                            >
                                                                Amount
                                                            </div>
                                                            <span className="card--value card--value__no-margin">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => this.setState(
                                                                        {
                                                                            formatFull: !this.state.formatFull
                                                                        }
                                                                    )}
                                                                >
                                                                    {this.state.formatFull
                                                                        ? `${output.output.amount} i`
                                                                        : UnitsHelper.formatBest(output.output.amount)}
                                                                </button>
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                            </div>
                            <div className="side-panel-container">
                                <SidePanel {...this.props} />
                                <ToolsPanel>
                                    <div className="card--section">
                                        <div className="card--label margin-t-t">
                                            <span>Advanced View</span>
                                            <input
                                                type="checkbox"
                                                checked={this.state.advancedMode}
                                                className="margin-l-t"
                                                onChange={e => this.setState(
                                                    {
                                                        advancedMode: e.target.checked
                                                    },
                                                    () => this._settingsService.saveSingle(
                                                        "advancedMode",
                                                        this.state.advancedMode))}
                                            />
                                        </div>
                                    </div>
                                </ToolsPanel>
                            </div>
                        </div>
                    </div>
                </div>
            </div >
        );
    }
}

export default Addr;
