# Difficulty simulation (runs per number: 3000)

Profiles (release timing, ms): skilled = spread 8, input 4, first-try misjudgment 20; average = spread 15, input 8, first-try misjudgment 40; beginner = spread 25, input 8, first-try misjudgment 70.

## Per-cliff success — A7 (now): 0.78/1 cm, frame physics

| Cliff | Ground | Target cm | Skilled 1st / retry | Average 1st / retry | Beginner 1st / retry |
|---|---|---|---|---|---|
| 1 | ROAD | 100 | 100% / 100% | 94% / 100% | 73% / 94% |
| 2 | ICE | 78 | 73% / 91% | 43% / 66% | 28% / 43% |
| 3 | ROAD | 61 | 86% / 96% | 62% / 81% | 40% / 64% |
| 4 | ICE | 47 | 28% / 41% | 14% / 24% | 9% / 14% |
| 5 | ICE | 37 | 27% / 38% | 15% / 25% | 8% / 15% |
| 6 | ICE | 29 | 44% / 55% | 28% / 42% | 16% / 29% |
| 7 | ICE | 23 | 0% / 0% | 0% / 0% | 0% / 0% |
| 8 | ROAD | 18 | 45% / 55% | 30% / 42% | 17% / 29% |
| 9 | ROAD | 14 | 22% / 22% | 14% / 21% | 8% / 15% |
| 10 | ICE | 11 | 0% / 0% | 0% / 0% | 0% / 0% |
| 11 | ROAD | 8.3 | 27% / 37% | 15% / 24% | 8% / 16% |
| 12 | MUD | 6.5 | 0% / 0% | 0% / 0% | 0% / 0% |
| 15 | ICE | 3.1 | 0% / 0% | 0% / 0% | 0% / 0% |
| 20 | ROAD | 1 | 0% / 0% | 0% / 0% | 0% / 0% |
| 25 | ROAD | 1 | 0% / 0% | 0% / 0% | 0% / 0% |
| 30 | ROAD | 1 | 0% / 0% | 0% / 0% | 0% / 0% |
| 40 | MUD | 1 | 0% / 0% | 0% / 0% | 0% / 0% |
| 50 | ROAD | 1 | 0% / 0% | 0% / 0% | 0% / 0% |
| 60 | ROAD | 1 | 0% / 0% | 0% / 0% | 0% / 0% |

## Per-cliff success — Prob: 0.40→0.25 by 50 (chosen)

| Cliff | Ground | Target cm | Skilled 1st / retry | Average 1st / retry | Beginner 1st / retry |
|---|---|---|---|---|---|
| 1 | ROAD | 90 | 100% / 100% | 92% / 100% | 69% / 92% |
| 2 | ROAD | 90 | 100% / 100% | 92% / 100% | 69% / 92% |
| 3 | MUD | 90 | 100% / 100% | 92% / 100% | 70% / 91% |
| 4 | ROAD | 86 | 100% / 100% | 87% / 99% | 62% / 87% |
| 5 | MUD | 82 | 99% / 100% | 82% / 98% | 58% / 82% |
| 6 | ICE | 86 | 100% / 100% | 91% / 100% | 67% / 92% |
| 7 | ROAD | 77 | 97% / 100% | 73% / 95% | 48% / 72% |
| 8 | MUD | 75 | 96% / 100% | 70% / 92% | 44% / 70% |
| 9 | ROAD | 68 | 94% / 100% | 65% / 88% | 40% / 63% |
| 10 | ICE | 47 | 90% / 100% | 59% / 85% | 36% / 60% |
| 11 | ROAD | 64 | 96% / 100% | 70% / 92% | 45% / 71% |
| 12 | MUD | 59 | 88% / 99% | 56% / 80% | 35% / 56% |
| 15 | ICE | 100 | 81% / 97% | 46% / 72% | 28% / 47% |
| 20 | ROAD | 29 | 72% / 93% | 41% / 62% | 23% / 40% |
| 25 | ROAD | 37 | 65% / 90% | 39% / 60% | 22% / 36% |
| 30 | ROAD | 30 | 64% / 87% | 36% / 55% | 20% / 35% |
| 40 | MUD | 27 | 55% / 80% | 30% / 49% | 17% / 29% |
| 50 | ROAD | 20 | 48% / 74% | 26% / 44% | 14% / 26% |
| 60 | ROAD | 18 | 48% / 72% | 25% / 43% | 14% / 25% |

## Sessions of 3 minutes (1000 players per cell)

| Design | Profile | Farthest cliff (median, 10%–90%) | Attempts | Back to checkpoint | Falls | Stuck at end (median s) |
|---|---|---|---|---|---|---|
| A7 (now): 0.78/1 cm, frame physics | skilled | 7 (5–7) | 32.2 | 5.4 | 3.5 | 101 |
| A7 (now): 0.78/1 cm, frame physics | average | 5 (4–7) | 33.7 | 5.4 | 5.6 | 111 |
| A7 (now): 0.78/1 cm, frame physics | beginner | 4 (4–5) | 34.7 | 6.3 | 7.7 | 118 |
| A7 targets + exact physics | skilled | 10 (8–12) | 33.7 | 4.6 | 8.0 | 54 |
| A7 targets + exact physics | average | 7 (5–9) | 34.1 | 5.3 | 8.8 | 76 |
| A7 targets + exact physics | beginner | 5 (4–7) | 35.0 | 6.4 | 10.2 | 109 |
| Naive: 0.85/2.5 cm | skilled | 13 (10–15) | 34.3 | 3.8 | 7.1 | 34 |
| Naive: 0.85/2.5 cm | average | 9 (5–10) | 34.0 | 4.9 | 8.3 | 52 |
| Naive: 0.85/2.5 cm | beginner | 5 (4–8) | 34.8 | 6.1 | 9.8 | 95 |
| Prob: flat 0.32 after 20 | skilled | 28 (24–33) | 36.1 | 1.0 | 3.4 | 2 |
| Prob: flat 0.32 after 20 | average | 19 (15–23) | 36.1 | 2.7 | 6.1 | 14 |
| Prob: flat 0.32 after 20 | beginner | 13 (9–15) | 36.1 | 4.3 | 8.1 | 35 |
| Prob: 0.40→0.25 by 50 (chosen) | skilled | 30 (25–33) | 36.1 | 0.7 | 3.0 | 0 |
| Prob: 0.40→0.25 by 50 (chosen) | average | 19 (15–23) | 36.1 | 2.7 | 6.1 | 10 |
| Prob: 0.40→0.25 by 50 (chosen) | beginner | 13 (9–15) | 36.1 | 4.3 | 8.1 | 35 |
| Prob: 0.40→0.18 by 50 | skilled | 29 (25–33) | 36.1 | 0.8 | 3.0 | 0 |
| Prob: 0.40→0.18 by 50 | average | 19 (15–23) | 36.1 | 2.7 | 6.1 | 10 |
| Prob: 0.40→0.18 by 50 | beginner | 13 (9–15) | 36.1 | 4.3 | 8.1 | 35 |

## Sessions of 10 minutes (1000 players per cell)

| Design | Profile | Farthest cliff (median, 10%–90%) | Attempts | Back to checkpoint | Falls | Stuck at end (median s) |
|---|---|---|---|---|---|---|
| A7 (now): 0.78/1 cm, frame physics | skilled | 7 (7–7) | 103.7 | 23.7 | 14.3 | 492 |
| A7 (now): 0.78/1 cm, frame physics | average | 7 (5–7) | 108.7 | 22.1 | 21.6 | 405 |
| A7 (now): 0.78/1 cm, frame physics | beginner | 5 (4–7) | 113.7 | 22.3 | 26.6 | 396 |
| A7 targets + exact physics | skilled | 13 (10–14) | 113.3 | 21.3 | 33.7 | 264 |
| A7 targets + exact physics | average | 9 (7–10) | 111.3 | 21.7 | 33.8 | 239 |
| A7 targets + exact physics | beginner | 5 (5–9) | 114.4 | 22.8 | 35.3 | 346 |
| Naive: 0.85/2.5 cm | skilled | 15 (15–19) | 117.1 | 20.1 | 32.5 | 244 |
| Naive: 0.85/2.5 cm | average | 10 (10–15) | 112.8 | 20.9 | 33.0 | 251 |
| Naive: 0.85/2.5 cm | beginner | 8 (5–10) | 113.7 | 22.1 | 34.4 | 265 |
| Prob: flat 0.32 after 20 | skilled | 66 (54–78) | 119.6 | 7.2 | 17.7 | 1 |
| Prob: flat 0.32 after 20 | average | 29 (24–35) | 120.9 | 17.1 | 29.5 | 82 |
| Prob: flat 0.32 after 20 | beginner | 19 (15–24) | 119.8 | 20.0 | 32.8 | 121 |
| Prob: 0.40→0.25 by 50 (chosen) | skilled | 59 (50–69) | 118.8 | 8.7 | 19.2 | 13 |
| Prob: 0.40→0.25 by 50 (chosen) | average | 30 (25–39) | 121.4 | 16.1 | 28.4 | 57 |
| Prob: 0.40→0.25 by 50 (chosen) | beginner | 19 (15–24) | 119.7 | 19.8 | 32.6 | 121 |
| Prob: 0.40→0.18 by 50 | skilled | 50 (45–58) | 118.4 | 10.7 | 21.5 | 40 |
| Prob: 0.40→0.18 by 50 | average | 30 (25–38) | 121.4 | 16.4 | 28.7 | 62 |
| Prob: 0.40→0.18 by 50 | beginner | 19 (15–24) | 119.7 | 19.8 | 32.4 | 122 |

## Sessions of 30 minutes (1000 players per cell)

| Design | Profile | Farthest cliff (median, 10%–90%) | Attempts | Back to checkpoint | Falls | Stuck at end (median s) |
|---|---|---|---|---|---|---|
| A7 (now): 0.78/1 cm, frame physics | skilled | 7 (7–7) | 307.1 | 77.6 | 44.3 | 1700 |
| A7 (now): 0.78/1 cm, frame physics | average | 7 (7–7) | 317.7 | 76.3 | 70.4 | 1486 |
| A7 (now): 0.78/1 cm, frame physics | beginner | 7 (5–7) | 335.0 | 72.0 | 83.5 | 1358 |
| A7 targets + exact physics | skilled | 14 (13–15) | 347.8 | 77.6 | 118.2 | 778 |
| A7 targets + exact physics | average | 10 (9–13) | 331.7 | 73.6 | 111.9 | 1048 |
| A7 targets + exact physics | beginner | 9 (5–10) | 337.3 | 74.0 | 112.3 | 884 |
| Naive: 0.85/2.5 cm | skilled | 19 (15–20) | 356.7 | 76.0 | 116.4 | 823 |
| Naive: 0.85/2.5 cm | average | 15 (10–15) | 345.3 | 73.6 | 112.4 | 762 |
| Naive: 0.85/2.5 cm | beginner | 10 (9–13) | 336.4 | 72.7 | 109.9 | 787 |
| Prob: flat 0.32 after 20 | skilled | 170 (149–192) | 354.2 | 25.1 | 57.2 | 2 |
| Prob: flat 0.32 after 20 | average | 49 (35–61) | 362.5 | 61.1 | 98.4 | 108 |
| Prob: flat 0.32 after 20 | beginner | 25 (20–30) | 361.4 | 72.6 | 112.4 | 421 |
| Prob: 0.40→0.25 by 50 (chosen) | skilled | 123 (105–143) | 356.3 | 36.8 | 70.1 | 15 |
| Prob: 0.40→0.25 by 50 (chosen) | average | 49 (40–55) | 360.4 | 60.7 | 97.7 | 162 |
| Prob: 0.40→0.25 by 50 (chosen) | beginner | 25 (20–33) | 362.7 | 71.0 | 110.2 | 357 |
| Prob: 0.40→0.18 by 50 | skilled | 80 (65–95) | 357.4 | 49.6 | 84.0 | 64 |
| Prob: 0.40→0.18 by 50 | average | 44 (39–50) | 363.2 | 63.6 | 101.4 | 235 |
| Prob: 0.40→0.18 by 50 | beginner | 25 (20–33) | 362.9 | 71.2 | 110.5 | 360 |

## Grades on successful stops, safe aim (middle of the zone) — chosen design

| Cliff | Target | GREAT under | PERFECT under | Beginner GOOD / GREAT / PERFECT | Average GOOD / GREAT / PERFECT | Skilled GOOD / GREAT / PERFECT |
|---|---|---|---|---|---|---|
| 1 | 90 | 10.0 | 2.0 | 95% / 4% / 1% | 99% / 1% / 0% | 100% / 0% / 0% |
| 3 | 90 | 10.0 | 2.0 | 94% / 5% / 1% | 99% / 1% / 0% | 100% / 0% / 0% |
| 5 | 82 | 10.0 | 2.0 | 92% / 6% / 2% | 97% / 3% / 0% | 100% / 0% / 0% |
| 8 | 75 | 10.0 | 2.0 | 89% / 9% / 2% | 93% / 6% / 1% | 99% / 1% / 0% |
| 10 | 47 | 10.0 | 2.0 | 80% / 16% / 4% | 84% / 13% / 3% | 95% / 5% / 0% |
| 15 | 100 | 10.0 | 2.0 | 91% / 8% / 1% | 93% / 6% / 2% | 97% / 2% / 0% |
| 20 | 29 | 10.0 | 2.0 | 65% / 28% / 7% | 68% / 26% / 6% | 72% / 25% / 3% |
| 30 | 30 | 10.0 | 2.0 | 70% / 25% / 6% | 67% / 27% / 6% | 72% / 25% / 4% |
| 50 | 20 | 8.0 | 2.0 | 61% / 28% / 11% | 61% / 29% / 10% | 62% / 30% / 8% |

## Grades on successful stops, bold aim (chasing a close stop) — chosen design

| Cliff | Target | GREAT under | PERFECT under | Beginner GOOD / GREAT / PERFECT | Average GOOD / GREAT / PERFECT | Skilled GOOD / GREAT / PERFECT |
|---|---|---|---|---|---|---|
| 1 | 90 | 10.0 | 2.0 | 90% / 8% / 1% | 81% / 16% / 3% | 54% / 40% / 6% |
| 3 | 90 | 10.0 | 2.0 | 91% / 8% / 2% | 81% / 16% / 3% | 55% / 39% / 6% |
| 5 | 82 | 10.0 | 2.0 | 91% / 7% / 1% | 85% / 13% / 2% | 63% / 32% / 5% |
| 8 | 75 | 10.0 | 2.0 | 89% / 9% / 2% | 87% / 11% / 2% | 71% / 25% / 4% |
| 10 | 47 | 10.0 | 2.0 | 80% / 16% / 4% | 83% / 15% / 3% | 59% / 36% / 6% |
| 15 | 100 | 10.0 | 2.0 | 91% / 8% / 1% | 93% / 6% / 2% | 90% / 8% / 2% |
| 20 | 29 | 10.0 | 2.0 | 65% / 28% / 7% | 68% / 26% / 6% | 58% / 37% / 6% |
| 30 | 30 | 10.0 | 2.0 | 70% / 25% / 6% | 67% / 27% / 6% | 65% / 30% / 4% |
| 50 | 20 | 8.0 | 2.0 | 61% / 28% / 11% | 61% / 29% / 10% | 62% / 30% / 8% |

