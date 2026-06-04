# FutureLine Fitness — App UI Kit

Pixel-faithful recreation of the FutureLine mobile app, built with React + inline Babel.

## What's here

- `index.html` — click-through prototype showing all 6 screens
- `FLComponents.jsx` — atomic UI: buttons, inputs, cards, badges, tabs, nav, banners, option cards, macro bars, coach chat card
- `FLScreens.jsx` — screen compositions: Login, Onboarding, Dashboard, Meal Plan, Workout detail, Progress
- `ios-frame.jsx` — iOS device chrome (Dynamic Island, status bar, home indicator)

## Screens

| Screen | Source of truth |
| --- | --- |
| **Login** | `artifacts/web/src/pages/login.tsx` — white-chip logo, focused teal ring on password, gradient glow behind form |
| **Onboarding** | `artifacts/web/src/pages/onboarding.tsx` — step progress, `<OptionCard>` pattern |
| **Dashboard** | `artifacts/web/src/pages/dashboard.tsx` — "Am I On Track?" card, macro bars, collapsible Coach chat, quick-action grid |
| **Meal Plan** | `artifacts/web/src/pages/meal-plan.tsx` — day selector, totals row, meal rows with time badge |
| **Workout** | `artifacts/web/src/pages/workout-plan.tsx` — exercise list with imagery, Start button |
| **Progress** | `artifacts/web/src/pages/progress.tsx` — weight chart, stat tiles, log action |

## Using the kit

```jsx
<FLCard glow>
  <FLOverline>Am I On Track?</FLOverline>
  <MacroBar label="Protein" consumed={168} planned={165} color={FL.protein} />
</FLCard>

<FLButton variant="primary" size="lg" icon="flame">Start Workout</FLButton>
```

All tokens live on `window.FL` (colors) and match `colors_and_type.css`.

## Deliberate omissions

- The admin panel, coach dashboard, and 17 other secondary pages — out of scope; core member experience only
- No real data fetching — everything is static in-component
- Lucide icons substituted for any exotic iconography (the real app uses Lucide too, so no visual drift)
