"""Builds lib/fixtures.json for the portfolio demo.

Real and public: 2024 precinct results (SOS), sign counts by status and city (the campaign's own),
Wix website snapshots (the campaign's own, notes dropped), CFB report totals (public filings),
the treasurer's deadline rows (dates only).
Sample: every VoteBuilder figure in the Field Snapshot table. Values are invented and round.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "lib", "fixtures.json")

def rec(i, prefix, fields, created="2026-11-02T12:00:00.000Z"):
    return {"id": f"rec{prefix}{i:011d}"[:17], "createdTime": created, "fields": fields}

T = {}

# --- Signs: status x city, the campaign's own counts (5 Nov 2026) ----------------------
STATUS, CITY = "fldBOtwXYDDQXd3BY", "fld7tymdLUFk32WYv"
counts = [
    ("Delivered", "Hastings", 391), ("Delivered", "Cottage Grove", 153), ("Delivered", "Denmark Twp", 13), ("Delivered", "", 3),
    ("No sign", "Hastings", 151), ("No sign", "Cottage Grove", 60), ("No sign", "Denmark Twp", 5), ("No sign", "", 1),
    ("Declined", "Hastings", 8), ("Declined", "Cottage Grove", 1), ("Needs delivery", "Hastings", 1), ("Hold", "Other", 2),
]
rows, i = [], 0
for s, c, n in counts:
    for _ in range(n):
        f = {STATUS: s}
        if c: f[CITY] = c
        rows.append(rec(i, "SGN", f)); i += 1
T["tbl7iKg1Nnb6mh4Nf"] = rows
T["tblT2v41v90hrpr6c"] = []  # no open routes after delivery ended

# --- 2024 House 41B by precinct, SOS certified (Fox, Dippel) --------------------------
pairs = [(1119, 936), (784, 749), (1418, 1313), (676, 682), (804, 875), (806, 822), (872, 942), (1, 0),
         (715, 709), (1854, 1775), (407, 555), (211, 353), (689, 916), (890, 1081), (773, 821)]
T["tblMVsRE8a6WSkm6j"] = [rec(j, "ELX", {"fldzJuxHtxNNxxGKL": f, "fldyO3KETCnLI0q9o": d}) for j, (f, d) in enumerate(pairs)]

# --- Web snapshots, Wix Analytics (campaign's own) -----------------------------------
W = dict(date="fld9ZTK14CwTTgCo6", label="fldQSr5H3PeOUsvAH", s7="fldngmIyXp2kHjJjC", v7="fldpgoVGBcA3gTMRM", f7="fldKfnw5aAcS988PS",
         s30="fldS8FItofRgOWE4T", v30="fldNOem9NaMJiONzT", f30="flddf8X3oOfvCWhbR")
web = [("2026-11-01", 377, 334, 1, 1454, 1243, 1), ("2026-10-31", 375, 336, 1, 1453, 1240, 1), ("2026-10-30", 362, 326, 1, 1476, 1256, 1),
       ("2026-10-29", 351, 317, 1, 1522, 1301, 1), ("2026-10-26", 405, 366, 0, 1608, 1373, 1), ("2026-10-25", 402, 362, 0, 1641, 1394, 1),
       ("2026-10-20", 310, 273, 0, 1770, 1440, 1), ("2026-10-12", 273, 244, 0, 1806, 1443, 2), ("2026-10-04", 468, 424, 0, 1663, 1298, 5),
       ("2026-09-28", 631, 555, 1, 1435, 1093, 7), ("2026-09-24", 514, 414, 0, 1177, 888, 8), ("2026-09-18", 263, 242, 1, 846, 616, 13)]
T["tblUGpWxubHH53nlo"] = [rec(j, "WEB", {W["date"]: d, W["label"]: f"Web {d}", W["s7"]: a, W["v7"]: b, W["f7"]: c, W["s30"]: e, W["v30"]: g, W["f30"]: h})
                          for j, (d, a, b, c, e, g, h) in enumerate(web)]

# --- Field Snapshot: SAMPLE values, nothing from VoteBuilder -------------------------
S = dict(label="fldHNrpTKFBZDPLtd", attempts="fldBn8hGh4b4jZhi7", conv="fld2ZYGxq5wdV0i5G", by="fldDnXZbEPYnzYUwQ", date="fldroyJLKheRg29YP",
         notes="fldbsmK8CfMSr2niM", req="fldgkpKiEHvPb7axe", voted="fld727dzj1qFAJoR2", dA="fldg6tCMqWxi3eX0x", dC="fldrDmuqPDCwECEp3",
         appsCG="fldzcA0d68h2cLhcs", votedCG="fld9NOX8EWE0eKURI", appsWash="fldIh3l6QNbyGRK7p", votedWash="fldkk8F7Duf7IQRnY",
         sJ="fldcgUuPoBMWJx1W5", lJ="fldnSwJKQOAqnNXJI", u="fld1xkq6r1ikZnFpz", lG="fldzXqdDOv2CQrZSs", sG="fldGbiI1uckhznr4t", nv="fldFEQeEk4EXn4r0O",
         uCG="fldRXeQuVVuS6t5iJ", l2="fldcPYHDPpodymesH", l265="fldcDwx9P5EI7rjVo")
snap = [
    # date, attempts, conv, doorA, doorC, req, voted, appsCG, votedCG, appsWash, votedWash, sJ, lJ, u, lG, sG, nv, uCG, l2, l265
    ("2026-11-02", 44000, 10000, 38500, 9300, 8000, 7000, 3300, 2900, 3550, 3110, 3600, 1050, 1600, 270, 210, 35, 600, 6400, 3900),
    ("2026-10-27", 41000, 9200, 36000, 8800, 7400, 5600, 3050, 2300, 3270, 2480, 3400, 1000, 1550, 260, 200, 30, 580, 5200, 3300),
    ("2026-10-20", 38000, 8500, 33500, 8200, 6700, 3900, 2750, 1600, 2950, 1730, 3200, 950, 1500, 250, 195, 28, 560, 3700, 2500),
    ("2026-10-13", 35000, 7800, 31000, 7600, 6100, 2400, 2500, 950, 2690, 1030, 3000, 900, 1450, 240, 190, 25, 540, 2300, 1600),
    ("2026-10-05", 32500, 7200, 28500, 7000, 5600, 1500, 2300, 600, 2470, 650, 2800, 860, 1400, 230, 185, 22, 520, 1400, 1000),
]
T["tblzo7POZrIqJNBEt"] = [rec(j, "FLD", {
    S["label"]: f"Sample {d}", S["date"]: d, S["by"]: "Brian", S["attempts"]: a, S["conv"]: c, S["dA"]: da, S["dC"]: dc,
    S["req"]: rq, S["voted"]: vt, S["appsCG"]: ac, S["votedCG"]: vc, S["appsWash"]: aw, S["votedWash"]: vw,
    S["sJ"]: sj, S["lJ"]: lj, S["u"]: un, S["lG"]: lg, S["sG"]: sg, S["nv"]: nv, S["uCG"]: ucg, S["l2"]: l2, S["l265"]: l265,
    S["notes"]: "Sample values for the portfolio demo. Not VoteBuilder data.",
}) for j, (d, a, c, da, dc, rq, vt, ac, vc, aw, vw, sj, lj, un, lg, sg, nv, ucg, l2, l265) in enumerate(snap)]

# --- Treasurer: deadline rows (dates only) and CFB report totals (public filings) -----
DF = dict(name="fldiS7qtstqOXP1oR", kind="fldMdcrsb9qx6M1Kw", started="fldrsMalBCWE0f9jV", due="fldMbTKUjqbn6szPD",
          status="fldHMc3UP9fXgirXd", doneOn="fldbOgFMsGsnlA4hN", key="fldtF8tuZGAhpLU8D", note="fld5yNAMYHEZbW8AX")
T["tblYdUaJ5bsHKjjbB"] = [
    rec(0, "DLN", {DF["name"]: "Pre-general report", DF["kind"]: "Fixed", DF["due"]: "2026-10-26", DF["status"]: "Done", DF["doneOn"]: "2026-10-26", DF["key"]: "pre-general-2026"}),
    rec(1, "DLN", {DF["name"]: "Large contribution notice window", DF["kind"]: "Fixed", DF["due"]: "2026-11-02", DF["status"]: "Done", DF["doneOn"]: "2026-11-02", DF["key"]: "lcn-general-2026"}),
]
MF = dict(label="fld33WHwjDV1tR3k5", asOf="fldCdKjU7Dr5l6SMm", cash="fldC6CLA0TZa4rW1B", raised="fld7wXyKVi80cw3St", spend="fldaRWwwKIgi5wgNV",
          subsidy="fldC9ZuqWkL59k05q", special="fld65Sp3FEVtOWjij", party="fldhrPfL5YtbQgEXX", notes="fldYKRRSG5Rxoh0UL")
T["tblBWpDTx9YWJ6qFf"] = [
    rec(0, "MNY", {MF["label"]: "Pre-general report", MF["asOf"]: "2026-10-19", MF["raised"]: 125558.71, MF["cash"]: 80214.23, MF["spend"]: 69669.11,
                   MF["subsidy"]: 7674.62, MF["special"]: 14150, MF["party"]: 7900, MF["notes"]: "From the 2026 pre-general report filed with the Campaign Finance Board."}),
    rec(1, "MNY", {MF["label"]: "Pre-primary report", MF["asOf"]: "2026-07-20", MF["raised"]: 62525.74, MF["cash"]: 87518.29,
                   MF["notes"]: "From the 2026 pre-primary report filed with the Campaign Finance Board."}),
]

# --- Team tasks: sample rows only --------------------------------------------------
K = dict(title="fldqM8qt9ShxvHmL0", owner="fldgxbUIV3uc36uXK", due="fldCatBPXl5X1CcEM", status="fldpdxEYd4AE6nJVC", category="fldEgxuEqs76U1WpO")
T["tbl3WFideiZxmt7i0"] = [
    rec(0, "TSK", {K["title"]: "Reconcile November deposits against the bank statement", K["owner"]: "Treasurer", K["due"]: "2026-11-20", K["status"]: "Not started", K["category"]: "Compliance"}),
    rec(1, "TSK", {K["title"]: "Pay final vendor invoices before year-end", K["owner"]: "Treasurer", K["due"]: "2026-12-15", K["status"]: "Not started", K["category"]: "Compliance"}),
]
for t in ("tblnDmOlehtIR85w1", "tblSpH5A5Z1lVKM0J", "tbl5up3C7Qv60g9Bt"):
    T[t] = []

with open(OUT, "w") as fh:
    json.dump(T, fh)
print("wrote", OUT, {k: len(v) for k, v in T.items()})
