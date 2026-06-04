// FLScreens.jsx — Full screen compositions

function LoginScreen({ onLogin }) {
  const [email, setEmail] = React.useState('sarah@futureline.fit');
  const [password, setPassword] = React.useState('••••••••');
  return (
    <div style={{
      height: '100%', overflow: 'auto', padding: '80px 24px 40px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      background: FL.bg, color: FL.fg, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '-30%', width: '160%', height: '60%',
        background: 'rgba(45,212,191,0.08)', filter: 'blur(100px)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 8,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(45,212,191,0.15)',
          }}>
            <img src="../../assets/logo.png" style={{ width: 56, height: 56, objectFit: 'contain', display: 'block' }} />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Welcome back</h1>
          <p style={{ margin: '6px 0 0', color: FL.fgMuted, fontSize: 14 }}>Sign in to continue your program</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FLInput label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <FLInput label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} focused />
          <FLButton variant="primary" size="lg" onClick={onLogin} style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>Sign In</FLButton>
          <div style={{ textAlign: 'center', fontSize: 13, color: FL.fgMuted, marginTop: 6 }}>
            Don't have an account? <span style={{ color: FL.primary, fontWeight: 600 }}>Sign up</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────
function DashboardScreen({ onNav, onOpenWorkout }) {
  const [tab, setTab] = React.useState('daily');
  return (
    <div style={{ height: '100%', overflow: 'auto', background: FL.bg, color: FL.fg, paddingBottom: 80 }}>
      <FLAppHeader subtitle="Tuesday · Jan 21" title="Welcome back, Sarah" notifCount={3} />

      <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <FLTabs items={[{key:'daily',label:'Daily'},{key:'weekly',label:'Weekly'}]} active={tab} onChange={setTab} />
        </div>

        {/* Coach messages */}
        <FLCoachCard unread={2} />

        {/* Am I on track card */}
        <FLCard padding={0}>
          <div style={{ padding: '16px 20px 4px' }}>
            <FLOverline>Am I On Track?</FLOverline>
          </div>
          <div style={{ padding: '12px 20px 20px' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <MiniStatPill label="Planned" value={380} unit="kcal" color={FL.fg} />
              <MiniStatPill label="Burned" value={485} unit="kcal" color={FL.burn} />
              <MiniStatPill label="Deficit" value={380} unit="kcal" color={FL.primary} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <MacroBar label="Protein" consumed={168} planned={165} color={FL.protein} />
              <MacroBar label="Carbs" consumed={220} planned={280} color={FL.carbs} />
              <MacroBar label="Fat" consumed={55} planned={72} color={FL.fat} />
              <MacroBar label="Calories" consumed={2120} planned={2450} unit=" kcal" color={FL.primary} />
            </div>
          </div>
        </FLCard>

        {/* Quick actions */}
        <div>
          <div style={{ padding: '0 4px 10px' }}><FLOverline>Today's Plan</FLOverline></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <QuickCard icon="utensils-crossed" label="Meal Plan" sub="3 meals · 2 snacks" onClick={() => onNav?.('meals')} />
            <QuickCard icon="dumbbell" label="Workout" sub="Upper Body · 45 min" onClick={onOpenWorkout} active />
            <QuickCard icon="shopping-cart" label="Groceries" sub="14 items" onClick={() => onNav?.('shop')} />
            <QuickCard icon="trending-up" label="Weigh-in" sub="+0.2 kg this wk" onClick={() => onNav?.('progress')} />
          </div>
        </div>
      </div>
      <FLBottomNav active="dashboard" onNav={onNav} />
    </div>
  );
}

function QuickCard({ icon, label, sub, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      padding: 16, borderRadius: 20, fontFamily: 'inherit', cursor: 'pointer',
      textAlign: 'left',
      background: active ? 'rgba(45,212,191,0.08)' : FL.bgEl,
      border: `1px solid ${active ? 'rgba(45,212,191,0.3)' : FL.hairline}`,
      display: 'flex', flexDirection: 'column', gap: 12,
      color: FL.fg, transition: 'all 150ms ease',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: active ? FL.primary : 'rgba(45,212,191,0.1)',
        color: active ? FL.primaryFg : FL.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Ico name={icon} size={18} /></div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: FL.fgMuted, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

// ─── Workout detail ──────────────────────────────────────────────
function WorkoutScreen({ onBack }) {
  const exercises = [
    { name: 'Barbell Bench Press', sets: '4 × 8', img: '../../assets/exercises/barbell-bench-press.png' },
    { name: 'Dumbbell Shoulder Press', sets: '3 × 10', img: '../../assets/exercises/dumbbell-shoulder-press.png' },
    { name: 'Lateral Raises', sets: '3 × 12', img: '../../assets/exercises/lateral-raises.png' },
    { name: 'Tricep Pushdown', sets: '3 × 10', img: '../../assets/exercises/tricep-pushdown.png' },
    { name: 'Leg Press (superset)', sets: '3 × 12', img: '../../assets/exercises/leg-press.png' },
  ];
  return (
    <div style={{ height: '100%', overflow: 'auto', background: FL.bg, color: FL.fg, paddingBottom: 100 }}>
      <div style={{ padding: '56px 20px 16px', position: 'relative' }}>
        <button onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 12, background: FL.bgEl,
          border: `1px solid ${FL.border}`, color: FL.fg, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}><Ico name="arrow-left" size={18} /></button>
        <FLOverline>Tuesday · 45 min</FLOverline>
        <h1 style={{ margin: '6px 0 4px', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Upper Body — Push</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <FLBadge variant="tinted">Week 4 / 12</FLBadge>
          <FLBadge variant="outline">5 exercises</FLBadge>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FLBanner variant="primary" icon="user-check" title="Your Coach"
          message="Focus on bar path on bench today — Mariam" />

        <div style={{ padding: '8px 4px 4px' }}><FLOverline>Exercises</FLOverline></div>
        {exercises.map((e, i) => (
          <FLListRow key={i}
            image={e.img}
            title={e.name}
            subtitle={`${e.sets} · 90s rest`}
            trailing={<div style={{
              width: 32, height: 32, borderRadius: 999, background: FL.bg,
              border: `1px solid ${FL.border}`, color: FL.fgMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Ico name="chevron-right" size={14} /></div>}
          />
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <FLButton variant="outline" size="lg" icon="rotate-ccw" style={{ flex: 1, justifyContent: 'center' }}>Swap</FLButton>
          <FLButton variant="primary" size="lg" icon="flame" style={{ flex: 2, justifyContent: 'center' }}>Start Workout</FLButton>
        </div>
      </div>
    </div>
  );
}

// ─── Meal plan ───────────────────────────────────────────────────
function MealPlanScreen({ onNav }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const [active, setActive] = React.useState(1);
  const meals = [
    { name: 'Breakfast', time: '7:30', items: 'Oats, berries, whey', kcal: 520 },
    { name: 'Snack', time: '10:30', items: 'Greek yogurt, almonds', kcal: 280 },
    { name: 'Lunch', time: '13:00', items: 'Grilled chicken, rice, veg', kcal: 680 },
    { name: 'Snack', time: '16:30', items: 'Protein shake, banana', kcal: 350 },
    { name: 'Dinner', time: '19:30', items: 'Salmon, sweet potato, salad', kcal: 620 },
  ];
  return (
    <div style={{ height: '100%', overflow: 'auto', background: FL.bg, color: FL.fg, paddingBottom: 100 }}>
      <FLAppHeader subtitle="Week 4 · January" title="Meal Plan" />

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* day selector */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {days.map((d, i) => {
            const isActive = i === active;
            return (
              <button key={i} onClick={() => setActive(i)} style={{
                flex: 1, padding: '10px 0', borderRadius: 14,
                border: `1px solid ${isActive ? FL.primary : FL.hairline}`,
                background: isActive ? 'rgba(45,212,191,0.1)' : FL.bgEl,
                color: isActive ? FL.primary : FL.fgMuted,
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 10, letterSpacing: '0.1em' }}>{d.toUpperCase()}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{20 + i}</span>
              </button>
            );
          })}
        </div>

        <FLCard>
          <FLOverline>Tuesday's Totals</FLOverline>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <Totals label="Calories" value="2450" unit="kcal" color={FL.primary} />
            <Totals label="Protein" value="165" unit="g" color={FL.protein} />
            <Totals label="Carbs" value="280" unit="g" color={FL.carbs} />
            <Totals label="Fat" value="72" unit="g" color={FL.fat} />
          </div>
        </FLCard>

        <div>
          <div style={{ padding: '0 4px 10px' }}><FLOverline>Meals</FLOverline></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meals.map((m, i) => <MealRow key={i} {...m} />)}
          </div>
        </div>
      </div>
      <FLBottomNav active="meals" onNav={onNav} />
    </div>
  );
}

function Totals({ label, value, unit, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: FL.fgMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, color: FL.fgMuted }}>{unit}</div>
    </div>
  );
}

function MealRow({ name, time, items, kcal }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: 14,
      background: FL.bgEl, borderRadius: 20, border: `1px solid ${FL.hairline}`,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: 'rgba(45,212,191,0.1)',
        color: FL.primary, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 600 }}>{time.split(':')[0]}</span>
        <span style={{ fontSize: 9, color: FL.fgMuted }}>:{time.split(':')[1]}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: FL.primary }}>{kcal} kcal</span>
        </div>
        <div style={{ fontSize: 12, color: FL.fgMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{items}</div>
      </div>
    </div>
  );
}

// ─── Progress ────────────────────────────────────────────────────
function ProgressScreen({ onNav }) {
  const weeks = [
    { w: 'W1', weight: 82.4, bar: 72 },
    { w: 'W2', weight: 81.8, bar: 62 },
    { w: 'W3', weight: 81.2, bar: 52 },
    { w: 'W4', weight: 80.6, bar: 42 },
    { w: 'W5', weight: 80.1, bar: 35 },
    { w: 'W6', weight: 79.5, bar: 26 },
    { w: 'W7', weight: 79.0, bar: 20 },
    { w: 'W8', weight: 78.4, bar: 12 },
  ];
  return (
    <div style={{ height: '100%', overflow: 'auto', background: FL.bg, color: FL.fg, paddingBottom: 100 }}>
      <FLAppHeader subtitle="Last 8 weeks" title="Progress" />

      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FLCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <FLOverline>Current Weight</FLOverline>
              <div style={{ fontSize: 48, fontWeight: 300, color: FL.primary, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 6 }}>78.4</div>
              <div style={{ fontSize: 12, color: FL.fgMuted, marginTop: 4 }}>kg · Goal 76.0 kg</div>
            </div>
            <FLBadge variant="tinted" style={{ fontSize: 11 }}>
              <Ico name="trending-down" size={12} /> −4.0 kg
            </FLBadge>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 20 }}>
            {weeks.map((w, i) => {
              const h = 100 - w.bar;
              const isLast = i === weeks.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: '100%', height: h, borderRadius: 6,
                    background: isLast ? FL.primary : 'rgba(45,212,191,0.3)',
                    boxShadow: isLast ? `0 0 12px ${FL.primaryGlow}` : 'none',
                    transition: 'all 400ms ease',
                  }} />
                  <div style={{ fontSize: 10, color: FL.fgMuted }}>{w.w}</div>
                </div>
              );
            })}
          </div>
        </FLCard>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile icon="flame" label="Avg deficit" value="380" unit="kcal/day" color={FL.primary} />
          <StatTile icon="dumbbell" label="Workouts" value="22" unit="completed" color={FL.info} />
          <StatTile icon="zap" label="Streak" value="14" unit="day streak" color={FL.warning} />
          <StatTile icon="ruler" label="Waist" value="−3.2" unit="cm" color={FL.success} />
        </div>

        <FLButton variant="primary" size="lg" icon="plus" style={{ justifyContent: 'center' }}>Log new weigh-in</FLButton>
      </div>
      <FLBottomNav active="progress" onNav={onNav} />
    </div>
  );
}

function StatTile({ icon, label, value, unit, color }) {
  return (
    <div style={{
      padding: 16, borderRadius: 20, background: FL.bgEl,
      border: `1px solid ${FL.hairline}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: 'rgba(45,212,191,0.1)',
        color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
      }}><Ico name={icon} size={16} /></div>
      <div style={{ fontSize: 10, fontWeight: 600, color: FL.fgMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: FL.fg, letterSpacing: '-0.02em', marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: FL.fgMuted, marginTop: 2 }}>{unit}</div>
    </div>
  );
}

// ─── Onboarding ──────────────────────────────────────────────────
function OnboardingScreen({ onContinue }) {
  const [goal, setGoal] = React.useState('cut');
  return (
    <div style={{ height: '100%', overflow: 'auto', background: FL.bg, color: FL.fg, padding: '56px 24px 32px' }}>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
      }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= 1 ? FL.primary : 'rgba(45,212,191,0.15)',
          }} />
        ))}
      </div>

      <FLOverline>Step 2 of 4</FLOverline>
      <h1 style={{ margin: '6px 0 4px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>What's your goal?</h1>
      <p style={{ margin: '0 0 24px', color: FL.fgMuted, fontSize: 14 }}>Pick one. Your coach will tailor your plan.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FLOptionCard icon="trending-down" title="Cut (Lose fat)" description="Moderate deficit, preserve muscle" selected={goal==='cut'} onClick={() => setGoal('cut')} />
        <FLOptionCard icon="trending-up" title="Lean Bulk" description="Small surplus, build mass slowly" selected={goal==='bulk'} onClick={() => setGoal('bulk')} />
        <FLOptionCard icon="dumbbell" title="Maintain & Recomp" description="Hold weight, shift body composition" selected={goal==='recomp'} onClick={() => setGoal('recomp')} />
        <FLOptionCard icon="heart" title="Just feel better" description="Balanced eating, general fitness" selected={goal==='health'} onClick={() => setGoal('health')} />
      </div>

      <div style={{ marginTop: 32 }}>
        <FLButton variant="primary" size="lg" onClick={onContinue} style={{ width: '100%', justifyContent: 'center' }}>Continue</FLButton>
      </div>
    </div>
  );
}

Object.assign(window, {
  LoginScreen, DashboardScreen, WorkoutScreen, MealPlanScreen, ProgressScreen, OnboardingScreen,
});
