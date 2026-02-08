"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartyRole = exports.Visibility = exports.AgreementStatus = exports.AgreementType = void 0;
// ── Enums (matching on-chain u8 constants) ──
var AgreementType;
(function (AgreementType) {
    AgreementType[AgreementType["Safe"] = 0] = "Safe";
    AgreementType[AgreementType["Service"] = 1] = "Service";
    AgreementType[AgreementType["RevenueShare"] = 2] = "RevenueShare";
    AgreementType[AgreementType["JointVenture"] = 3] = "JointVenture";
    AgreementType[AgreementType["Custom"] = 4] = "Custom";
})(AgreementType || (exports.AgreementType = AgreementType = {}));
var AgreementStatus;
(function (AgreementStatus) {
    AgreementStatus[AgreementStatus["Proposed"] = 0] = "Proposed";
    AgreementStatus[AgreementStatus["Active"] = 1] = "Active";
    AgreementStatus[AgreementStatus["Fulfilled"] = 2] = "Fulfilled";
    AgreementStatus[AgreementStatus["Breached"] = 3] = "Breached";
    AgreementStatus[AgreementStatus["Disputed"] = 4] = "Disputed";
    AgreementStatus[AgreementStatus["Cancelled"] = 5] = "Cancelled";
})(AgreementStatus || (exports.AgreementStatus = AgreementStatus = {}));
var Visibility;
(function (Visibility) {
    Visibility[Visibility["Public"] = 0] = "Public";
    Visibility[Visibility["Private"] = 1] = "Private";
})(Visibility || (exports.Visibility = Visibility = {}));
var PartyRole;
(function (PartyRole) {
    PartyRole[PartyRole["Proposer"] = 0] = "Proposer";
    PartyRole[PartyRole["Counterparty"] = 1] = "Counterparty";
    PartyRole[PartyRole["Witness"] = 2] = "Witness";
    PartyRole[PartyRole["Arbitrator"] = 3] = "Arbitrator";
})(PartyRole || (exports.PartyRole = PartyRole = {}));
//# sourceMappingURL=types.js.map