import React, { ReactNode } from "react";
import { Link, RouteComponentProps } from "react-router-dom";
import { UnitsHelper } from "../../helpers/unitsHelper";
import { IFeedItemChrysalis } from "../../models/api/og/IFeedItemChrysalis";
import { IFeedItemOg } from "../../models/api/og/IFeedItemOg";
import Feeds from "./Feeds";
import { FeedsState } from "./FeedsState";
import LineChart from "./LineChart";
import "./SidePanel.scss";
import { SidePanelRouteProps } from "./SidePanelRouteProps";

/**
 * Component which will show the side panel component.
 */
class SidePanel extends Feeds<RouteComponentProps<SidePanelRouteProps>, FeedsState> {
    /**
     * Create a new instance of SidePanel.
     * @param props The props.
     */
    constructor(props: RouteComponentProps<SidePanelRouteProps>) {
        super(props);

        this.state = {
            itemsPerSecond: "--",
            confirmedItemsPerSecond: "--",
            confirmedItemsPerSecondPercent: "--",
            itemsPerSecondHistory: [],
            items: [],
            confirmed: [],
            milestones: [],
            currency: "USD",
            currencies: []
        };
    }

    /**
     * Render the component.
     * @returns The node to render.
     */
    public render(): ReactNode {
        return (
            <div className="side-panel card">
                <div className="card--header">
                    <h2>Stats</h2>
                </div>
                <div className="card--sections">
                    <div className="card--section card--section__highlight">
                        <div className="card--label card--label__highlight padding-t-s">
                            {this._networkConfig?.protocolVersion === "og" ? "Transactions" : "Messages"} Per Second
                        </div>
                        <div className="card--value card--value__large padding-t-s">
                            {this.state.itemsPerSecond} / {this.state.confirmedItemsPerSecond}
                        </div>
                        <LineChart
                            values={this.state.itemsPerSecondHistory}
                        />
                    </div>
                    <div className="card--section feed">
                        <div className="card--label card--label__underline">
                            Milestones
                        </div>
                        {this.state.milestones.slice(0, 5).map(tx => (
                            <div className="row feed-item" key={tx.hash}>
                                <span className="feed-item--value">{tx.milestoneIndex}</span>
                                <Link
                                    className="feed-item--hash"
                                    to={`/${this.props.match.params.network}/transaction/${tx.hash}`}
                                >
                                    {tx.hash}
                                </Link>
                            </div>
                        ))}
                        <div className="card--sep" />
                    </div>
                    <div className="card--section feed">
                        <div className="card--label card--label__underline">
                            {this._networkConfig?.protocolVersion === "og" ? "Transactions" : "Messages"}
                        </div>
                        {this.state.items.slice(0, 5).map(item => (
                            <div className="row feed-item" key={item.id}>
                                {this.isValueItem(item) && (
                                    <span className="feed-item--value">
                                        {UnitsHelper.formatBest(item.value)}
                                    </span>
                                )}
                                {!this.isValueItem(item) && (
                                    <span className="feed-item--value">
                                        {(item as IFeedItemChrysalis).payloadType === 1
                                            ? "MS" : "Index"}
                                    </span>
                                )}
                                <Link
                                    className="feed-item--hash"
                                    to={`/${this.props.match.params.network}/transaction/${item.id}`}
                                >
                                    {item.id}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    /**
     * Is this a value item.
     * @param item Is this a value item.
     * @returns True if this is a value item.
     */
    private isValueItem(item: IFeedItemOg | IFeedItemChrysalis): boolean {
        // eslint-disable-next-line no-prototype-builtins
        if (item.hasOwnProperty("payloadType")) {
            const feedItemChrysalis = item as IFeedItemChrysalis;
            return feedItemChrysalis.payloadType === 0;
        }
        return true;
    }
}

export default SidePanel;
