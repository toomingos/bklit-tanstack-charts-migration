# 5.3.5 — final full-matrix QA pass

> Run 2026-08-27, `@tanstack/charts@0.15.0` / `@tanstack/react-charts@0.15.0` (exact pins). 43 runs = the GATE-MAP 45-run roster minus the two excluded instruments (`candletween` n=1000, `ring` n=1000 — `GATE-MAP.md:18-20`). Ran strictly sequentially; the harness binds port 5198.

## Headline

| | |
|---|---|
| runs | **43 / 43** |
| gate cells | **160** |
| cells outside their own historical range | **0** |
| FAIL cells | **5** — 4 `barloading` (not a parity gate by design, D341) + 1 `choropleth` hover-30 (harness race, see below) |
| cells bit-identical to `BASELINE.md` | 78 |
| cells landing on a repeated historical value (mode) | 18 |
| cells inside the historical range | 64 |

**Not one cell in the matrix produced a value the harness has not produced before.** Judged under the D402 rule — a cell is compared against the mode distribution in `qa/results/<chart>/*/report.json`, never a single BASELINE sample — this is the strongest statement the instrument can make.

## The one real FAIL: `choropleth` n=100 hover-30

```
hover-30   FAIL  1.2434% differing pixels  tooltipA=false tooltipB=true
  - hover-30 (A=bklit): tooltip not visible 700ms after hover (checked via text-length-heuristic)
```
**Harness settle race, not a divergence — and this time it fired on the reference implementation.** Three independent reasons:

1. **The failing side flips.** On 2026-08-18 the same cell read `1.2451%` with `A=true B=false` (migrated missing its tooltip). Today it reads `1.2434%` with `A=false B=true` — *bklit* missing its tooltip. A real implementation defect cannot change which implementation it afflicts.
2. **The failing side is code we never touch.** Impl A is `showcase/repos/bklit-ui/**`, protected and unmodified across the whole phase. Its tooltip failed to paint within `HOVER_WAIT_MS`.
3. **Six consecutive re-runs PASS at exactly `0.0000%`**, `tooltipA=true tooltipB=true`. Full distribution over 18 samples: **13 x 0 px** against 4 outliers (11953, 11937, 9082, 9101) — i.e. the whole tooltip panel painted or not painted, nothing in between.

`HOVER_WAIT_MS = 700` carries the harness's own note that it was raised from 150 ms *"so bklit's tooltip spring fully settles before capture"* (`qa/screenshot.mjs:109-111`). 700 ms is evidently still marginal for choropleth's geo tooltip. Raising it is a change to a **protected** file and is parked with the D402/D403 gate-race item, which needs gate-author approval.

## `candlestick` — the T0 chart

All four cells PASS. **CORRECTED by D411** — this was first written up as `hover-30` at "4771 px against a 4800 px gate, 29 px of headroom", which framed a straddling cell as a comfortable pass. The cell's own 58-run history has **9 readings OVER the 4800 gate** (4827 x2, 4879, 4889, 4908, 4953, plus 6091 / 7126 / 12213 degenerates) against dense modes at 4755/4764/4769/4771/4783 — it fails roughly 1 run in 7, and the most recent over-gate reading is 2026-08-26T22:16, i.e. live rather than retired. In every over-gate run the `settled` cell is bit-identical to baseline and only the hover cell crosses, which attributes it to hover-capture timing (`qa/screenshot.mjs:109-111`) rather than to chart geometry — the same instrument defect as the `choropleth` FAIL above. Consistent with D402's finding that this chart sits inherently at 0.48-0.50% and has FAILed three times this phase on run-to-run variance alone. It was not touched in 5.3 and its settled cell is bit-identical to baseline (`2904 px`, 41 prior occurrences).

## Full board

`px` is the count of differing pixels out of 960 000; the gate is 4800 px (0.5%). `history` lists the four most frequent historical values for that exact (chart, n, cell) with their occurrence counts.

```
area               1000  settled   0.0003     0.0003   3       PASS  = baseline                53x3, 1x1235, 1x90356                   55
area               1000  hover-30  0.0001     0.0001   1       PASS  = baseline                43x1, 4x506, 2x21, 2x2098               55
area               1000  hover-50  0.0001     0.0559   537     PASS  in-mode-dist (n=29)       29x537, 18x1, 2x16, 2x2099              55
area               1000  hover-70  0.1593     0.1582   1519    PASS  in-mode-dist (n=2)        20x1529, 18x1517, 4x1296, 2x1519        55
arealoading        1000  settled   0.0238     0.0575   552     PASS  in-range [227,552]        3x228, 1x227, 1x232, 1x552              6
arealoading        1000  hover-30  0.0619     0.0247   237     PASS  in-range [237,658]        1x237, 1x494, 1x561, 1x594              6
arealoading        1000  hover-50  0.0252     0.0434   417     PASS  in-range [239,417]        1x239, 1x242, 1x243, 1x244              6
arealoading        1000  hover-70  0.0324     0.0259   249     PASS  in-range [249,361]        1x249, 1x305, 1x311, 1x321              6
areamultiaxis      1000  settled   0.0007     0.0007   7       PASS  = baseline                8x7, 1x25957                            9
areamultiaxis      1000  hover-30  0.0003     0.1393   1337    PASS  in-range [3,6173]         7x3, 1x1337, 1x6173                     9
areamultiaxis      1000  hover-50  0.0842     0.1296   1244    PASS  in-range [803,7154]       6x808, 1x803, 1x1244, 1x7154            9
areamultiaxis      1000  hover-70  0.1869     0.1862   1788    PASS  in-mode-dist (n=2)        3x1794, 2x1788, 2x1795, 1x1786          9
bar                100   settled   0.0000     0.0000   0       PASS  = baseline                67x0, 8x170923, 1x84539                 76
bar                100   hover-30  0.0000     0.0833   800     PASS  in-mode-dist (n=2)        47x0, 14x14, 8x165438, 4x13731          76
bar                100   hover-50  0.0757     0.1012   972     PASS  in-range [0,165017]       25x727, 19x0, 15x16, 5x165017           76
bar                100   hover-70  0.0000     0.0080   77      PASS  in-range [0,163385]       23x0, 21x1193, 15x15, 5x163385          76
bardepth           100   settled   0.0030     0.0030   29      PASS  = baseline                21x29, 1x239441                         22
bardepth           100   hover-30  0.0005     0.0044   42      PASS  in-range [5,8868]         17x5, 2x476, 1x42, 1x2343               22
bardepth           100   hover-50  0.0454     0.0157   151     PASS  in-range [5,8868]         13x436, 5x5, 1x151, 1x670               22
bardepth           100   hover-70  0.0748     0.0241   231     PASS  in-range [5,8868]         9x719, 5x5, 4x472, 1x231                22
barloading         100   settled   2.0031     5.4013   51852   FAIL  in-range [18124,51852]    2x18216, 1x18124, 1x19230, 1x44866      6
barloading         100   hover-30  16.5953    16.7728  161019  FAIL  in-range [158874,161019]  1x158874, 1x159007, 1x159109, 1x159315  6
barloading         100   hover-50  16.7929    14.8568  142625  FAIL  in-range [142625,161336]  2x161336, 1x142625, 1x156711, 1x161212  6
barloading         100   hover-70  16.8837    16.8095  161371  FAIL  in-range [159081,164456]  2x164456, 1x159081, 1x161371, 1x161542  6
barmultiaxis       100   settled   0.0000     0.0000   0       PASS  = baseline                7x0, 1x59737                            8
barmultiaxis       100   hover-30  0.0000     0.0000   0       PASS  = baseline                5x0, 2x436, 1x43579                     8
barmultiaxis       100   hover-50  0.0745     0.0187   180     PASS  in-range [180,43652]      3x715, 2x915, 1x180, 1x714              8
barmultiaxis       100   hover-70  0.0722     0.0079   76      PASS  in-range [76,44649]       3x1053, 2x1169, 1x76, 1x693             8
barsquares         100   settled   0.0049     0.0049   47      PASS  = baseline                13x44, 7x47, 1x53                       21
barsquares         100   hover-30  0.1364     0.1170   1123    PASS  in-range [353,1419]       2x1309, 1x353, 1x442, 1x537             21
barsquares         100   hover-50  0.1504     0.0555   533     PASS  in-range [294,1542]       1x294, 1x533, 1x874, 1x1129             21
barsquares         100   hover-70  0.1486     0.1482   1423    PASS  in-range [731,1675]       3x1427, 1x731, 1x934, 1x1397            21
brush              1000  settled   0.0001     0.0001   1       PASS  = baseline                18x1, 1x227                             19
candlelegend       1000  settled   0.3211     0.3211   3083    PASS  = baseline                11x3083                                 11
candlestick        1000  settled   0.3025     0.3025   2904    PASS  = baseline                41x2904, 7x2905, 4x2502, 1x12061        55
candlestick        1000  hover-30  0.4953     0.4970   4771    PASS  in-range [4381,12213]     18x4764, 11x4755, 6x4783, 3x4381        55
candlestick        1000  hover-50  0.3661     0.3223   3094    PASS  in-mode-dist (n=4)        11x3515, 11x3524, 5x3103, 5x3122        55
candlestick        1000  hover-70  0.3618     0.3618   3473    PASS  = baseline                15x3482, 10x3473, 6x3141, 3x3122        55
choropleth         100   settled   0.0000     0.0000   0       PASS  = baseline                16x0                                    16
choropleth         100   hover-30  0.0000     0.0000   0       PASS  = baseline                11x0, 2x11953, 1x9082, 1x9101           16
choropleth         100   hover-50  0.1470     0.1470   1411    PASS  = baseline                12x1411, 2x404, 2x442                   16
choropleth         100   hover-70  0.0000     0.0000   0       PASS  = baseline                12x0, 2x1292, 1x1290, 1x1320            16
composed           1000  settled   0.0845     0.0845   811     PASS  = baseline                42x811, 2x3222, 1x0, 1x2894             57
composed           1000  hover-30  0.0000     0.0725   696     PASS  in-mode-dist (n=6)        38x0, 6x696, 5x35, 2x33                 57
composed           1000  hover-50  0.0000     0.0765   734     PASS  in-mode-dist (n=2)        18x0, 16x735, 5x1131, 4x44              57
composed           1000  hover-70  0.1394     0.1801   1729    PASS  in-mode-dist (n=2)        14x1738, 4x1331, 3x1731, 3x1732         57
composedmultiaxis  1000  settled   0.0890     0.0890   854     PASS  = baseline                8x854, 1x59696                          9
composedmultiaxis  1000  hover-30  0.0478     0.0480   461     PASS  in-mode-dist (n=3)        3x459, 3x461, 1x460, 1x1229             9
composedmultiaxis  1000  hover-50  0.0485     0.0485   466     PASS  = baseline                3x466, 2x1640, 1x1202, 1x1203           9
composedmultiaxis  1000  hover-70  0.2209     0.2207   2119    PASS  in-range [1666,3314]      2x2121, 2x2126, 1x1666, 1x2119          9
composedstacked    100   settled   0.0408     0.0406   390     PASS  in-mode-dist (n=2)        4x392, 2x390                            6
composedstacked    100   hover-30  0.1152     0.0174   167     PASS  in-range [129,1106]       4x1106, 1x129, 1x167                    6
composedstacked    100   hover-50  0.1230     0.0346   332     PASS  in-range [129,1181]       4x1181, 1x129, 1x332                    6
composedstacked    100   hover-70  0.1172     0.1218   1169    PASS  in-range [1125,1790]      4x1125, 1x1169, 1x1790                  6
funnel             1000  settled   0.0000     0.0000   0       PASS  = baseline                18x0, 1x2, 1x230                        20
funnel             1000  hover-30  0.0000     0.0000   0       PASS  = baseline                20x0                                    20
funnel             1000  hover-50  0.0000     0.0000   0       PASS  = baseline                20x0                                    20
funnel             1000  hover-70  0.0000     0.0000   0       PASS  = baseline                20x0                                    20
funnelvertical     1000  settled   0.0000     0.0000   0       PASS  = baseline                13x0                                    13
funnelvertical     1000  hover-30  0.0000     0.0000   0       PASS  = baseline                13x0                                    13
funnelvertical     1000  hover-50  0.0000     0.0000   0       PASS  = baseline                13x0                                    13
funnelvertical     1000  hover-70  0.0000     0.0000   0       PASS  = baseline                13x0                                    13
gauge              1000  settled   0.0064     0.0066   63      PASS  in-range [46,1077]        5x46, 4x61, 4x1017, 2x57                24
gauge              1000  hover-30  0.0064     0.0066   63      PASS  in-range [46,1077]        6x46, 4x61, 4x1017, 2x57                24
gauge              1000  hover-50  0.0064     0.0066   63      PASS  in-range [46,1077]        6x46, 4x61, 4x1017, 2x57                24
gauge              1000  hover-70  0.0064     0.0066   63      PASS  in-range [46,1077]        6x46, 4x61, 4x1017, 2x57                24
gaugelinear        1000  settled   0.0000     0.0000   0       PASS  = baseline                12x0, 3x216                             15
gaugelinear        1000  hover-30  0.0000     0.0000   0       PASS  = baseline                12x0, 3x216                             15
gaugelinear        1000  hover-50  0.0000     0.0000   0       PASS  = baseline                12x0, 3x216                             15
gaugelinear        1000  hover-70  0.0000     0.0000   0       PASS  = baseline                12x0, 3x216                             15
griddefault        1000  settled   0.0000     0.0000   0       PASS  = baseline                10x0                                    10
griddefault        1000  hover-30  0.0000     0.0000   0       PASS  = baseline                10x0                                    10
griddefault        1000  hover-50  0.0536     0.0000   0       PASS  in-mode-dist (n=2)        8x515, 2x0                              10
griddefault        1000  hover-70  0.1422     0.1632   1567    PASS  in-range [1365,1567]      8x1365, 1x1366, 1x1567                  10
heatmap            52    settled   0.4277     0.4277   4106    PASS  = baseline                41x4106, 5x1455, 1x1485, 1x28521        48
heatmap            52    hover-30  0.3466     0.3466   3327    PASS  = baseline                26x3327, 10x4988, 2x2952, 2x4568        48
heatmap            52    hover-50  0.3533     0.3533   3392    PASS  = baseline                26x3392, 9x5010, 3x5009, 2x3003         48
heatmap            52    hover-70  0.4256     0.4256   4086    PASS  = baseline                23x4086, 8x5708, 4x5707, 3x4062         48
legend             1000  settled   0.0000     0.0000   0       PASS  = baseline                8x0                                     8
legendhover        1000  settled   0.0593     0.0593   569     PASS  = baseline                9x569, 2x568                            11
line               1000  settled   0.0000     0.0000   0       PASS  = baseline                73x0, 2x1053, 1x6677, 1x9570            77
line               1000  hover-30  0.0000     0.0000   0       PASS  = baseline                65x0, 4x12, 2x489, 1x807                77
line               1000  hover-50  0.0540     0.0540   518     PASS  = baseline                34x0, 32x518, 2x10, 2x528               77
line               1000  hover-70  0.1478     0.1241   1191    PASS  in-mode-dist (n=2)        36x1434, 24x1419, 4x1449, 2x1191        77
linemultiaxis      1000  settled   0.0000     0.0000   0       PASS  = baseline                9x0, 1x6422                             10
linemultiaxis      1000  hover-30  0.0000     0.1146   1100    PASS  in-range [0,1100]         8x0, 1x70, 1x1100                       10
linemultiaxis      1000  hover-50  0.1249     0.1248   1198    PASS  in-range [0,1201]         4x776, 2x1199, 1x0, 1x846               10
linemultiaxis      1000  hover-70  0.1794     0.2180   2093    PASS  in-range [1722,2093]      8x1722, 1x1767, 1x2093                  10
liveline           100   settled   0.0167     0.0737   708     PASS  in-range [158,708]        3x160, 2x164, 2x167, 2x169              41
liveline           100   hover-30  0.0506     0.1024   983     PASS  in-range [486,1357]       3x877, 2x486, 1x502, 1x504              41
liveline           100   hover-50  0.0827     0.0773   742     PASS  in-range [554,1058]       2x844, 2x877, 1x554, 1x581              41
liveline           100   hover-70  0.1023     0.1414   1357    PASS  in-range [802,1357]       2x1060, 2x1065, 2x1078, 1x802           41
markers            100   settled   0.1100     0.0819   786     PASS  in-range [786,7024]       2x1090, 1x786, 1x965, 1x1052            23
markers            100   hover-30  0.3872     0.3826   3673    PASS  in-range [3574,8430]      7x3717, 5x5287, 3x3715, 2x8430          23
markers            100   hover-50  0.1823     0.0875   840     PASS  in-range [840,5817]       10x1750, 2x2476, 2x2477, 1x840          23
markers            100   hover-70  0.3784     0.3832   3679    PASS  in-range [3328,8004]      7x3633, 4x3631, 3x4750, 1x3328          23
patternarea        1000  settled   0.0002     0.0002   2       PASS  = baseline                14x2                                    14
patternarea        1000  hover-30  0.0002     0.0482   463     PASS  in-range [2,463]          13x2, 1x463                             14
patternarea        1000  hover-50  0.0541     0.0843   809     PASS  in-range [2,809]          11x519, 2x2, 1x809                      14
patternarea        1000  hover-70  0.1388     0.1443   1385    PASS  in-range [1093,1385]      9x1332, 2x1356, 1x1093, 1x1095          14
pie                1000  settled   0.0138     0.0311   299     PASS  in-range [0,816]          2x82, 1x0, 1x52, 1x54                   33
pie                1000  hover-30  0.0000     0.0000   0       PASS  = baseline                24x0, 2x30554, 2x30556, 1x146           33
pie                1000  hover-50  0.0000     0.0000   0       PASS  = baseline                30x0, 1x146, 1x728, 1x30562             33
pie                1000  hover-70  0.0007     0.0007   7       PASS  = baseline                23x7, 2x30445, 1x0, 1x153               33
profitloss         1000  settled   0.0189     0.0189   181     PASS  = baseline                7x181, 6x184, 4x186, 1x413              18
profitloss         1000  hover-30  0.0152     0.0152   146     PASS  = baseline                7x146, 6x149, 2x151, 2x183              18
profitloss         1000  hover-50  0.0516     0.0516   495     PASS  = baseline                6x495, 6x498, 2x500, 2x506              18
profitloss         1000  hover-70  0.1375     0.1375   1320    PASS  = baseline                7x1320, 4x1323, 3x1423, 2x1425          18
projection         1000  settled   0.0166     0.0149   143     PASS  in-range [40,688]         3x158, 2x150, 2x156, 2x157              20
projection         1000  hover-30  0.1435     0.1189   1141    PASS  in-mode-dist (n=3)        5x1378, 3x1141, 3x1375, 2x1380          20
projection         1000  hover-50  0.0881     0.0881   846     PASS  = baseline                7x555, 4x846, 3x3, 2x10                 20
projection         1000  hover-70  0.0540     0.0848   814     PASS  in-range [1,1709]         7x518, 3x3, 1x1, 1x5                    20
projectionxdomain  1000  settled   0.0724     0.0724   695     PASS  = baseline                5x694, 2x695, 1x642, 1x732              11
projectionxdomain  1000  hover-30  0.0360     0.0360   346     PASS  = baseline                6x346, 1x2683, 1x4050, 1x4942           11
projectionxdomain  1000  hover-50  0.0360     0.0360   346     PASS  = baseline                6x346, 1x2683, 1x4123, 1x4997           11
projectionxdomain  1000  hover-70  0.0907     0.0907   871     PASS  = baseline                6x871, 1x3197, 1x3881, 1x4702           11
radar              6     settled   0.0141     0.0141   135     PASS  = baseline                5x135                                   5
radar              6     hover-30  0.0128     0.0129   124     PASS  in-range [123,124]        4x123, 1x124                            5
radar              6     hover-50  0.0888     0.0886   851     PASS  in-range [851,852]        4x852, 1x851                            5
radar              6     hover-70  0.0141     0.0141   135     PASS  = baseline                5x135                                   5
refarea            1000  settled   0.0021     0.0248   238     PASS  in-range [0,424]          17x20, 2x0, 1x170, 1x238                22
refarea            1000  hover-30  0.0000     0.0122   117     PASS  in-range [0,1666]         16x0, 2x11, 2x516, 1x117                22
refarea            1000  hover-50  0.0523     0.0000   0       PASS  in-mode-dist (n=5)        14x502, 5x0, 2x14, 1x1749               22
refarea            1000  hover-70  0.1451     0.1672   1605    PASS  in-range [1132,2889]      7x1393, 3x1389, 3x1394, 2x1387          22
refareamultiaxis   1000  settled   0.1978     0.1927   1850    PASS  in-range [20,309469]      2x1904, 1x20, 1x40, 1x616               11
refareamultiaxis   1000  hover-30  0.1827     0.1830   1757    PASS  in-range [0,300532]       5x1754, 2x0, 1x1430, 1x1596             11
refareamultiaxis   1000  hover-50  0.2800     0.1847   1773    PASS  in-range [764,301423]     4x2688, 1x764, 1x766, 1x1773            11
refareamultiaxis   1000  hover-70  0.3767     0.3773   3622    PASS  in-range [1713,301910]    3x3617, 1x1713, 1x1724, 1x3161          11
ring               4     settled   0.0000     0.0000   0       PASS  = baseline                14x0, 12x578, 5x119                     31
ring               4     hover-30  0.3111     0.3132   3007    PASS  in-mode-dist (n=2)        2x2987, 2x3007, 2x3045, 1x14            31
ring               4     hover-50  0.3105     0.3096   2972    PASS  in-range [47,3055]        3x2995, 2x152, 2x2893, 2x3020           31
ring               4     hover-70  0.0142     0.0129   124     PASS  in-range [14,3096]        2x181, 2x711, 2x3039, 1x14              31
sankey             33    settled   0.1101     0.1101   1057    PASS  = baseline                15x1057, 6x1048, 3x5631, 3x185495       50
sankey             33    hover-30  0.3835     0.3924   3767    PASS  in-range [3506,28944]     2x3690, 2x10147, 2x16091, 2x23834       50
sankey             33    hover-50  0.2782     0.2997   2877    PASS  in-range [2630,31186]     2x2870, 2x26087, 1x2630, 1x2671         50
sankey             33    hover-70  0.1323     0.1701   1633    PASS  in-range [1270,33134]     2x1761, 1x1270, 1x1527, 1x1567          50
scatter            1000  settled   0.4510     0.4510   4330    PASS  = baseline                38x4329, 12x4330, 5x38, 2x4323          60
scatter            1000  hover-30  0.0762     0.0000   0       PASS  in-mode-dist (n=38)       38x0, 4x731, 3x732, 2x650               60
scatter            1000  hover-50  0.0779     0.1252   1202    PASS  in-mode-dist (n=3)        24x748, 11x0, 8x749, 3x1202             60
scatter            1000  hover-70  0.2964     0.2607   2503    PASS  in-range [1884,23324]     8x2508, 6x2847, 5x2821, 5x2845          60
scattermultiaxis   1000  settled   0.2898     0.2898   2782    PASS  = baseline                7x2782, 1x143970                        8
scattermultiaxis   1000  hover-30  0.0001     0.0000   0       PASS  in-mode-dist (n=5)        5x0, 1x1, 1x732, 1x127866               8
scattermultiaxis   1000  hover-50  0.0000     0.0000   0       PASS  = baseline                4x748, 3x0, 1x128172                    8
scattermultiaxis   1000  hover-70  0.2736     0.2215   2126    PASS  in-range [2123,129924]    1x2123, 1x2126, 1x2616, 1x2624          8
segment            1000  settled   0.0000     0.0000   0       PASS  = baseline                17x0                                    17
segment            1000  hover-30  0.0000     0.0000   0       PASS  = baseline                14x0, 2x10, 1x1244                      17
segment            1000  hover-50  0.0532     0.0532   511     PASS  = baseline                10x511, 3x0, 2x8, 1x776                 17
segment            1000  hover-70  0.1435     0.1128   1083    PASS  in-range [1083,2459]      10x1378, 3x1380, 2x1393, 1x1083         17
sunburst           33    settled   0.0599     0.0599   575     PASS  = baseline                15x575                                  15
sunburst           33    hover-30  0.0744     0.0744   714     PASS  = baseline                14x714, 1x21867                         15
sunburst           33    hover-50  0.1046     0.1046   1004    PASS  = baseline                14x1004, 1x34655                        15
sunburst           33    hover-70  0.0872     0.0872   837     PASS  = baseline                14x837, 1x49859                         15
sunburst           27    settled   0.0599     0.0599   575     PASS  = baseline                27x575, 2x0, 2x1112, 1x1115             37
sunburst           27    hover-30  0.0780     0.0780   749     PASS  = baseline                19x749, 2x0, 2x7037, 2x7389             37
sunburst           27    hover-50  0.1400     0.1400   1344    PASS  = baseline                20x1344, 2x0, 2x1328, 2x1605            37
sunburst           27    hover-70  0.1466     0.1466   1407    PASS  = baseline                22x1407, 2x0, 2x1559, 2x3015            37
sunchrome          27    settled   0.0677     0.0677   650     PASS  = baseline                7x650                                   7
sunchrome          27    hover-30  0.0931     0.0931   894     PASS  = baseline                7x894                                   7
sunchrome          27    hover-50  0.1548     0.1548   1486    PASS  = baseline                7x1486                                  7
sunchrome          27    hover-70  0.1676     0.1676   1609    PASS  = baseline                7x1609                                  7
```

## Excluded from the run

| run | why |
|---|---|
| `candletween` n=1000 | pixel-invalid by design (D330 §2); gate of record is `qa/k4-tween-probe.mjs` |
| `ring` n=1000 | invalid instrument (D335); `ring` n=4 is the gate of record and is in the board above |

