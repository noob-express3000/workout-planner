const STORAGE_KEY = 'workout-planner.v2';

const TARGETS = {
  bench_press: { label: 'Bench Press', type: 'lift', muscle: 'chest' },
  squat: { label: 'Squat', type: 'lift', muscle: 'quads' },
  deadlift: { label: 'Deadlift', type: 'lift', muscle: 'hamstrings' },
  overhead_press: { label: 'Overhead Press', type: 'lift', muscle: 'shoulders' },
  chest: { label: 'Chest', type: 'muscle', muscle: 'chest' },
  back: { label: 'Back', type: 'muscle', muscle: 'back' },
  shoulders: { label: 'Shoulders', type: 'muscle', muscle: 'shoulders' },
  biceps: { label: 'Biceps', type: 'muscle', muscle: 'biceps' },
  triceps: { label: 'Triceps', type: 'muscle', muscle: 'triceps' },
  quads: { label: 'Quads', type: 'muscle', muscle: 'quads' },
  hamstrings: { label: 'Hamstrings', type: 'muscle', muscle: 'hamstrings' },
  glutes: { label: 'Glutes', type: 'muscle', muscle: 'glutes' },
  calves: { label: 'Calves', type: 'muscle', muscle: 'calves' },
};

const EXERCISES = {
  bench_press: [
    { name: 'Barbell bench press', requires: ['barbell', 'bench'], reps: '4–6' },
    { name: 'Dumbbell bench press', requires: ['dumbbells', 'bench'], reps: '6–10' },
    { name: 'Dumbbell floor press', requires: ['dumbbells'], reps: '6–10' },
    { name: 'Push-up', requires: ['bodyweight'], reps: '8–20' },
  ],
  squat: [
    { name: 'Back squat', requires: ['barbell', 'rack'], reps: '3–6' },
    { name: 'Front squat', requires: ['barbell', 'rack'], reps: '4–8' },
    { name: 'Goblet squat', requires: ['dumbbells'], reps: '8–12' },
    { name: 'Split squat', requires: ['bodyweight'], reps: '8–15 / leg' },
  ],
  deadlift: [
    { name: 'Conventional deadlift', requires: ['barbell'], reps: '3–5' },
    { name: 'Romanian deadlift', requires: ['barbell'], reps: '5–8' },
    { name: 'Dumbbell Romanian deadlift', requires: ['dumbbells'], reps: '6–10' },
    { name: 'Single-leg hip hinge', requires: ['bodyweight'], reps: '8–15 / leg' },
  ],
  overhead_press: [
    { name: 'Barbell overhead press', requires: ['barbell'], reps: '4–6' },
    { name: 'Dumbbell overhead press', requires: ['dumbbells'], reps: '6–10' },
    { name: 'Pike push-up', requires: ['bodyweight'], reps: '6–15' },
  ],
  chest: [
    { name: 'Dumbbell bench press', requires: ['dumbbells', 'bench'], reps: '6–12' },
    { name: 'Barbell bench press', requires: ['barbell', 'bench'], reps: '5–10' },
    { name: 'Cable fly', requires: ['cables'], reps: '10–20' },
    { name: 'Push-up', requires: ['bodyweight'], reps: '8–20' },
  ],
  back: [
    { name: 'Pull-up', requires: ['pullup'], reps: '5–12' },
    { name: 'Barbell row', requires: ['barbell'], reps: '6–10' },
    { name: 'One-arm dumbbell row', requires: ['dumbbells'], reps: '8–15' },
    { name: 'Cable row', requires: ['cables'], reps: '8–15' },
  ],
  shoulders: [
    { name: 'Dumbbell overhead press', requires: ['dumbbells'], reps: '6–10' },
    { name: 'Dumbbell lateral raise', requires: ['dumbbells'], reps: '10–20' },
    { name: 'Cable lateral raise', requires: ['cables'], reps: '10–20' },
    { name: 'Pike push-up', requires: ['bodyweight'], reps: '6–15' },
  ],
  biceps: [
    { name: 'Dumbbell curl', requires: ['dumbbells'], reps: '8–15' },
    { name: 'Barbell curl', requires: ['barbell'], reps: '6–12' },
    { name: 'Cable curl', requires: ['cables'], reps: '10–15' },
  ],
  triceps: [
    { name: 'Close-grip bench press', requires: ['barbell', 'bench'], reps: '6–10' },
    { name: 'Dumbbell overhead extension', requires: ['dumbbells'], reps: '8–15' },
    { name: 'Cable pressdown', requires: ['cables'], reps: '10–20' },
    { name: 'Close-grip push-up', requires: ['bodyweight'], reps: '8–20' },
  ],
  quads: [
    { name: 'Back squat', requires: ['barbell', 'rack'], reps: '5–8' },
    { name: 'Goblet squat', requires: ['dumbbells'], reps: '8–15' },
    { name: 'Split squat', requires: ['bodyweight'], reps: '8–15 / leg' },
    { name: 'Leg press', requires: ['machines'], reps: '8–15' },
  ],
  hamstrings: [
    { name: 'Romanian deadlift', requires: ['barbell'], reps: '5–10' },
    { name: 'Dumbbell Romanian deadlift', requires: ['dumbbells'], reps: '6–12' },
    { name: 'Leg curl', requires: ['machines'], reps: '8–15' },
    { name: 'Single-leg hip hinge', requires: ['bodyweight'], reps: '8–15 / leg' },
  ],
  glutes: [
    { name: 'Barbell hip thrust', requires: ['barbell', 'bench'], reps: '6–12' },
    { name: 'Dumbbell hip thrust', requires: ['dumbbells', 'bench'], reps: '8–15' },
    { name: 'Cable pull-through', requires: ['cables'], reps: '10–15' },
    { name: 'Single-leg glute bridge', requires: ['bodyweight'], reps: '10–20' },
  ],
  calves: [
    { name: 'Dumbbell calf raise', requires: ['dumbbells'], reps: '10–20' },
    { name: 'Barbell calf raise', requires: ['barbell'], reps: '8–20' },
    { name: 'Machine calf raise', requires: ['machines'], reps: '10–20' },
    { name: 'Single-leg calf raise', requires: ['bodyweight'], reps: '12–25' },
  ],
};

const ACCESSORIES = {
  chest: [
    { name: 'Dumbbell incline press', requires: ['dumbbells', 'bench'], reps: '8–12' },
    { name: 'Push-up', requires: ['bodyweight'], reps: '10–20' },
  ],
  quads: [
    { name: 'Split squat', requires: ['bodyweight'], reps: '8–12 / leg' },
    { name: 'Goblet squat', requires: ['dumbbells'], reps: '8–12' },
  ],
  hamstrings: [
    { name: 'Romanian deadlift', requires: ['barbell'], reps: '6–10' },
    { name: 'Dumbbell Romanian deadlift', requires: ['dumbbells'], reps: '8–12' },
  ],
  shoulders: [
    { name: 'Dumbbell lateral raise', requires: ['dumbbells'], reps: '12–20' },
    { name: 'Pike push-up', requires: ['bodyweight'], reps: '8–15' },
  ],
  back: [
    { name: 'One-arm dumbbell row', requires: ['dumbbells'], reps: '8–15' },
    { name: 'Pull-up', requires: ['pullup'], reps: '5–12' },
  ],
  biceps: [{ name: 'Dumbbell curl', requires: ['dumbbells'], reps: '8–15' }],
  triceps: [
    { name: 'Dumbbell overhead extension', requires: ['dumbbells'], reps: '10–15' },
    { name: 'Close-grip push-up', requires: ['bodyweight'], reps: '10–20' },
  ],
  glutes: [{ name: 'Dumbbell hip thrust', requires: ['dumbbells', 'bench'], reps: '8–15' }],
  calves: [{ name: 'Single-leg calf raise', requires: ['bodyweight'], reps: '12–25' }],
};

const BASELINE_DEFAULTS = {
  bench_press: { frequency: 1, directSets: 5, indirectSets: 2, loadKg: 80, reps: 5, rir: 1, adherence: 95 },
  squat: { frequency: 1, directSets: 5, indirectSets: 2, loadKg: 100, reps: 5, rir: 2, adherence: 90 },
  deadlift: { frequency: 1, directSets: 4, indirectSets: 2, loadKg: 120, reps: 5, rir: 2, adherence: 90 },
  overhead_press: { frequency: 1, directSets: 4, indirectSets: 3, loadKg: 45, reps: 5, rir: 2, adherence: 90 },
};

function defaultBaseline(targetId) {
  return BASELINE_DEFAULTS[targetId] || {
    frequency: 1,
    directSets: 4,
    indirectSets: 2,
    loadKg: 0,
    reps: 8,
    rir: 2,
    adherence: 90,
  };
}

function freshState() {
  const baselines = {};
  Object.keys(TARGETS).forEach((id) => { baselines[id] = { ...defaultBaseline(id) }; });
  return {
    version: 2,
    activeTarget: 'bench_press',
    profile: {
      goal: 'strength',
      trainingDays: 4,
      sessionDuration: 60,
      equipment: ['bodyweight', 'dumbbells', 'barbell', 'bench', 'rack'],
      readiness: 7,
      soreness: 2,
      sleepHours: 7.5,
    },
    baselines,
    programs: {},
    sets: [],
    workouts: [],
    recovery: [],
    decisions: [],
  };
}

function migrate(raw) {
  if (!raw || raw.version !== 2 || !raw.baselines) return freshState();
  const next = freshState();
  return {
    ...next,
    ...raw,
    profile: { ...next.profile, ...(raw.profile || {}) },
    baselines: { ...next.baselines, ...(raw.baselines || {}) },
    programs: raw.programs || {},
    sets: Array.isArray(raw.sets) ? raw.sets : [],
    workouts: Array.isArray(raw.workouts) ? raw.workouts : [],
    recovery: Array.isArray(raw.recovery) ? raw.recovery : [],
    decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
  };
}

function loadState() {
  try { return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return freshState(); }
}

let state = loadState();
const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const round = (value, places = 1) => Number(Number(value).toFixed(places));
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  document.dispatchEvent(new Event('trainingstatechange'));
}

function e1rm(loadKg, reps) {
  const load = Number(loadKg);
  const count = Number(reps);
  if (!Number.isFinite(load) || load <= 0 || !Number.isFinite(count) || count <= 0) return null;
  return round(load * (1 + count / 30), 1);
}

function cutoff(days = 7) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function targetInfo(targetId = state.activeTarget) {
  const info = TARGETS[targetId];
  if (!info) throw new Error(`Unknown target: ${targetId}`);
  return info;
}

function baselineFor(targetId = state.activeTarget) {
  if (!state.baselines[targetId]) state.baselines[targetId] = { ...defaultBaseline(targetId) };
  return state.baselines[targetId];
}

function recentWorkouts(targetId, days = 7) {
  const since = cutoff(days);
  return state.workouts.filter((item) => item.targetId === targetId && item.timestamp >= since);
}

function targetSets(targetId) {
  return state.sets.filter((item) => item.targetId === targetId).sort((a, b) => a.timestamp - b.timestamp);
}

function latestRecovery(targetId) {
  const matching = state.recovery.filter((item) => !item.targetId || item.targetId === targetId).sort((a, b) => b.timestamp - a.timestamp);
  if (matching.length) return matching[0];
  return {
    readiness: state.profile.readiness,
    soreness: state.profile.soreness,
    sleepHours: state.profile.sleepHours,
  };
}

function performanceMetrics(targetId = state.activeTarget) {
  const info = targetInfo(targetId);
  const baseline = baselineFor(targetId);
  const workouts = recentWorkouts(targetId);
  const loggedSets = targetSets(targetId);
  const recentSets = loggedSets.filter((item) => item.timestamp >= cutoff(28));
  const recovery = latestRecovery(targetId);

  const completedSets = workouts.reduce((sum, item) => sum + item.completedSets, 0);
  const plannedSets = workouts.reduce((sum, item) => sum + item.plannedSets, 0);
  const adherence = plannedSets > 0 ? completedSets / plannedSets : baseline.adherence / 100;
  const observedDirectSets = workouts.length ? completedSets : baseline.directSets;
  const effectiveSets = observedDirectSets + baseline.indirectSets * 0.5;
  const observedFrequency = workouts.length
    ? new Set(workouts.map((item) => new Date(item.timestamp).toDateString())).size
    : baseline.frequency;

  const baselineE1rm = info.type === 'lift' ? e1rm(baseline.loadKg, baseline.reps) : null;
  const performanceSets = recentSets.filter((item) => Number.isFinite(item.e1rm));
  const latestE1rm = performanceSets.length ? Math.max(...performanceSets.slice(-5).map((item) => item.e1rm)) : baselineE1rm;
  const trend = baselineE1rm && latestE1rm ? (latestE1rm - baselineE1rm) / baselineE1rm : null;
  const averageRir = workouts.length
    ? workouts.reduce((sum, item) => sum + item.rir, 0) / workouts.length
    : baseline.rir;

  return {
    targetId,
    label: info.label,
    type: info.type,
    muscle: info.muscle,
    effectiveSets: round(effectiveSets, 1),
    observedDirectSets,
    indirectSets: baseline.indirectSets,
    frequency: observedFrequency,
    adherence: round(adherence, 2),
    averageRir: round(averageRir, 1),
    readiness: clamp(recovery.readiness, 1, 10),
    soreness: clamp(recovery.soreness, 0, 10),
    sleepHours: clamp(recovery.sleepHours, 0, 16),
    baselineE1rm,
    latestE1rm,
    trend: trend === null ? null : round(trend, 4),
    workoutCount7d: workouts.length,
    setCount28d: recentSets.length,
  };
}

function assessTarget(targetId = state.activeTarget) {
  const metrics = performanceMetrics(targetId);
  const info = targetInfo(targetId);
  const minExposure = info.type === 'lift' ? 6 : 8;
  const recoveryLimited = metrics.soreness >= 7 || metrics.readiness <= 4 || metrics.sleepHours < 5.5 || metrics.adherence < 0.65;
  const clearlyProgressing = metrics.trend !== null && metrics.trend > 0.015 && metrics.adherence >= 0.8;
  const underexposed = metrics.effectiveSets < minExposure || (info.type === 'lift' && metrics.frequency < 2);
  const stalled = metrics.trend !== null && metrics.trend <= 0.005 && metrics.effectiveSets >= minExposure && metrics.adherence >= 0.8;

  let status = 'ADEQUATE';
  let reason = 'Exposure, execution, and recovery are inside the current working range.';
  let action = 'Hold the current structure and collect more performance data.';

  if (recoveryLimited) {
    status = 'RECOVERY_LIMITED';
    reason = 'Recovery or execution quality is too poor to justify adding work.';
    action = 'Reduce fatigue cost, increase RIR, and avoid adding volume until recovery improves.';
  } else if (clearlyProgressing) {
    status = 'PROGRESSING';
    reason = 'Performance improved while adherence and recovery remained acceptable.';
    action = 'Keep the structure stable and progress load conservatively.';
  } else if (underexposed) {
    status = 'UNDERTRAINED';
    reason = info.type === 'lift' && metrics.frequency < 2
      ? 'The target has low weekly exposure and only one meaningful practice opportunity.'
      : 'Effective weekly exposure is below the working threshold used by this engine.';
    action = info.type === 'lift'
      ? 'Add a second weekly exposure before making the sessions harder.'
      : 'Add targeted weekly sets while keeping effort recoverable.';
  } else if (stalled) {
    status = 'STALLED';
    reason = 'Exposure is sufficient, but recent performance is flat relative to baseline.';
    action = 'Redistribute work, preserve technique practice, and change the progression stimulus rather than blindly adding sets.';
  }

  return { ...metrics, status, reason, action };
}

function exerciseAvailable(exercise) {
  return exercise.requires.every((item) => state.profile.equipment.includes(item));
}

function firstAvailable(list = []) {
  return list.find(exerciseAvailable) || list.find((item) => item.requires.includes('bodyweight')) || list[0] || null;
}

function targetVolume(assessment) {
  const info = targetInfo(assessment.targetId);
  const current = assessment.effectiveSets;
  if (assessment.status === 'RECOVERY_LIMITED') return clamp(Math.round(current * 0.75), info.type === 'lift' ? 4 : 6, 10);
  if (assessment.status === 'UNDERTRAINED') return info.type === 'lift' ? clamp(Math.ceil(current + 2), 6, 9) : clamp(Math.ceil(current + 4), 8, 14);
  if (assessment.status === 'STALLED') return info.type === 'lift' ? clamp(Math.round(current), 6, 10) : clamp(Math.round(current + 1), 8, 16);
  if (assessment.status === 'PROGRESSING') return clamp(Math.round(current), info.type === 'lift' ? 6 : 8, info.type === 'lift' ? 10 : 16);
  return clamp(Math.round(current), info.type === 'lift' ? 6 : 8, info.type === 'lift' ? 10 : 14);
}

function targetFrequency(assessment) {
  const maxDays = state.profile.trainingDays;
  if (assessment.status === 'RECOVERY_LIMITED') return Math.min(maxDays, Math.max(1, assessment.frequency));
  if (assessment.type === 'lift') return Math.min(maxDays, Math.max(2, assessment.frequency));
  return Math.min(maxDays, assessment.effectiveSets >= 10 ? 2 : Math.max(1, assessment.frequency));
}

function buildLiftSessions(targetId, assessment, weeklySets, frequency) {
  const main = firstAvailable(EXERCISES[targetId]);
  const accessory = firstAvailable(ACCESSORIES[assessment.muscle]);
  const sessions = [];
  let remaining = weeklySets;

  for (let index = 0; index < frequency; index += 1) {
    const sessionsLeft = frequency - index;
    const sessionSets = Math.max(2, Math.ceil(remaining / sessionsLeft));
    remaining -= sessionSets;
    const mainSets = Math.max(2, Math.min(4, sessionSets - (accessory ? 2 : 0)));
    const accessorySets = Math.max(0, sessionSets - mainSets);
    const isSecondary = index > 0;
    const mainReps = isSecondary && main?.reps === '4–6' ? '6–8' : (main?.reps || '5–8');
    const targetRir = assessment.status === 'RECOVERY_LIMITED' ? 3 : (assessment.status === 'STALLED' ? 2.5 : 2);

    const exercises = [{ name: main?.name || assessment.label, sets: mainSets, reps: mainReps, rir: targetRir, role: isSecondary ? 'secondary practice' : 'primary lift' }];
    if (accessory && accessorySets > 0) exercises.push({ name: accessory.name, sets: accessorySets, reps: accessory.reps, rir: Math.max(2, targetRir), role: `${assessment.muscle} support` });
    sessions.push({ name: index === 0 ? 'Primary exposure' : `Secondary exposure ${index}`, exercises });
  }
  return sessions;
}

function buildMuscleSessions(targetId, assessment, weeklySets, frequency) {
  const available = (EXERCISES[targetId] || []).filter(exerciseAvailable);
  const picks = available.length ? available.slice(0, 2) : [firstAvailable(EXERCISES[targetId])].filter(Boolean);
  const sessions = [];
  let remaining = weeklySets;

  for (let index = 0; index < frequency; index += 1) {
    const sessionsLeft = frequency - index;
    const sessionSets = Math.max(3, Math.ceil(remaining / sessionsLeft));
    remaining -= sessionSets;
    let setsLeft = sessionSets;
    const exercises = picks.map((exercise, exerciseIndex) => {
      const slots = picks.length - exerciseIndex;
      const sets = Math.max(1, Math.ceil(setsLeft / slots));
      setsLeft -= sets;
      return {
        name: exercise?.name || `${assessment.label} movement`,
        sets,
        reps: exercise?.reps || '8–15',
        rir: assessment.status === 'RECOVERY_LIMITED' ? 3 : 2,
        role: exerciseIndex === 0 ? 'primary' : 'secondary',
      };
    });
    sessions.push({ name: `Targeted session ${index + 1}`, exercises });
  }
  return sessions;
}

function createProgram(targetId = state.activeTarget, { logDecision = true } = {}) {
  const assessment = assessTarget(targetId);
  const weeklySets = targetVolume(assessment);
  const frequency = targetFrequency(assessment);
  const sessions = assessment.type === 'lift'
    ? buildLiftSessions(targetId, assessment, weeklySets, frequency)
    : buildMuscleSessions(targetId, assessment, weeklySets, frequency);

  const program = {
    id: uid('program'),
    targetId,
    createdAt: Date.now(),
    sourceState: assessment.status,
    weeklySets,
    frequency,
    targetRir: assessment.status === 'RECOVERY_LIMITED' ? 3 : assessment.status === 'STALLED' ? 2.5 : 2,
    sessions,
    rationale: assessment.action,
  };
  state.programs[targetId] = program;
  if (logDecision) addDecision(targetId, `${assessment.status}: program rebuilt`, `${assessment.reason} ${assessment.action}`, assessment.status);
  saveState();
  return clone(program);
}

function getProgram(targetId = state.activeTarget) {
  return clone(state.programs[targetId] || null);
}

function addDecision(targetId, title, detail, status = null) {
  state.decisions.push({ id: uid('decision'), timestamp: Date.now(), targetId, title, detail, status });
  state.decisions = state.decisions.slice(-50);
}

function logSet(input = {}) {
  const targetId = input.targetId || state.activeTarget;
  targetInfo(targetId);
  const loadKg = clamp(input.loadKg ?? baselineFor(targetId).loadKg, 0, 600);
  const reps = clamp(input.reps ?? baselineFor(targetId).reps, 1, 100);
  const entry = {
    id: uid('set'),
    timestamp: Date.now(),
    targetId,
    exercise: String(input.exercise || targetInfo(targetId).label),
    loadKg,
    reps,
    rir: clamp(input.rir ?? baselineFor(targetId).rir, 0, 5),
    e1rm: targetInfo(targetId).type === 'lift' ? e1rm(loadKg, reps) : null,
  };
  state.sets.push(entry);
  saveState();
  return clone(entry);
}

function recordRecovery(input = {}) {
  const targetId = input.targetId || state.activeTarget;
  if (targetId) targetInfo(targetId);
  const entry = {
    id: uid('recovery'),
    timestamp: Date.now(),
    targetId,
    readiness: clamp(input.readiness ?? state.profile.readiness, 1, 10),
    soreness: clamp(input.soreness ?? state.profile.soreness, 0, 10),
    sleepHours: clamp(input.sleepHours ?? state.profile.sleepHours, 0, 16),
  };
  state.recovery.push(entry);
  state.profile.readiness = entry.readiness;
  state.profile.soreness = entry.soreness;
  state.profile.sleepHours = entry.sleepHours;
  addDecision(targetId, 'Recovery updated', `Readiness ${entry.readiness}/10, soreness ${entry.soreness}/10, sleep ${entry.sleepHours} h.`, assessTarget(targetId).status);
  saveState();
  return clone(entry);
}

function completeWorkout(input = {}) {
  const targetId = input.targetId || state.activeTarget;
  targetInfo(targetId);
  const program = state.programs[targetId];
  const plannedDefault = program?.sessions?.[0]?.exercises?.reduce((sum, item) => sum + item.sets, 0) || baselineFor(targetId).directSets;
  const plannedSets = clamp(input.plannedSets ?? plannedDefault, 1, 40);
  const completedSets = clamp(input.completedSets ?? plannedSets, 0, plannedSets);
  const rir = clamp(input.rir ?? baselineFor(targetId).rir, 0, 5);

  if (Number(input.loadKg) > 0 && Number(input.reps) > 0) {
    const loadKg = clamp(input.loadKg, 0, 600);
    const reps = clamp(input.reps, 1, 100);
    state.sets.push({
      id: uid('set'), timestamp: Date.now(), targetId,
      exercise: String(input.exercise || targetInfo(targetId).label),
      loadKg, reps, rir,
      e1rm: targetInfo(targetId).type === 'lift' ? e1rm(loadKg, reps) : null,
    });
  }

  const workout = {
    id: uid('workout'),
    timestamp: Date.now(),
    targetId,
    programId: program?.id || null,
    plannedSets,
    completedSets,
    rir,
    note: String(input.note || ''),
  };
  state.workouts.push(workout);

  if (input.readiness !== undefined || input.soreness !== undefined || input.sleepHours !== undefined) {
    const recovery = {
      id: uid('recovery'), timestamp: Date.now(), targetId,
      readiness: clamp(input.readiness ?? state.profile.readiness, 1, 10),
      soreness: clamp(input.soreness ?? state.profile.soreness, 0, 10),
      sleepHours: clamp(input.sleepHours ?? state.profile.sleepHours, 0, 16),
    };
    state.recovery.push(recovery);
    state.profile.readiness = recovery.readiness;
    state.profile.soreness = recovery.soreness;
    state.profile.sleepHours = recovery.sleepHours;
  }

  const after = assessTarget(targetId);
  addDecision(targetId, `Workout completed: ${after.status}`, `${completedSets}/${plannedSets} sets completed at ${rir} RIR. ${after.action}`, after.status);
  const nextProgram = createProgram(targetId, { logDecision: false });
  return { workout: clone(workout), assessment: after, nextProgram };
}

function updateTrainingProfile(input = {}) {
  const targetId = input.targetId || state.activeTarget;
  if (input.targetId) targetInfo(targetId);
  if (input.goal && ['strength', 'hypertrophy', 'power'].includes(input.goal)) state.profile.goal = input.goal;
  if (input.trainingDays !== undefined) state.profile.trainingDays = clamp(input.trainingDays, 1, 7);
  if (input.sessionDuration !== undefined) state.profile.sessionDuration = clamp(input.sessionDuration, 20, 180);
  if (Array.isArray(input.equipment) && input.equipment.length) state.profile.equipment = [...new Set(input.equipment.map(String))];
  if (input.readiness !== undefined) state.profile.readiness = clamp(input.readiness, 1, 10);
  if (input.soreness !== undefined) state.profile.soreness = clamp(input.soreness, 0, 10);
  if (input.sleepHours !== undefined) state.profile.sleepHours = clamp(input.sleepHours, 0, 16);

  const baseline = baselineFor(targetId);
  if (input.frequency !== undefined) baseline.frequency = clamp(input.frequency, 1, 7);
  if (input.directSets !== undefined) baseline.directSets = clamp(input.directSets, 0, 30);
  if (input.indirectSets !== undefined) baseline.indirectSets = clamp(input.indirectSets, 0, 30);
  if (input.loadKg !== undefined) baseline.loadKg = clamp(input.loadKg, 0, 600);
  if (input.reps !== undefined) baseline.reps = clamp(input.reps, 1, 100);
  if (input.rir !== undefined) baseline.rir = clamp(input.rir, 0, 5);
  if (input.adherence !== undefined) baseline.adherence = clamp(input.adherence, 0, 100);
  state.baselines[targetId] = baseline;

  addDecision(targetId, 'Training baseline updated', 'The agent or user changed the persistent training inputs used by the assessment engine.', assessTarget(targetId).status);
  saveState();
  return getTrainingState(targetId);
}

function setActiveTarget(targetId) {
  targetInfo(targetId);
  state.activeTarget = targetId;
  saveState();
  hydrateForm();
  return getTrainingState(targetId);
}

function getProgress(targetId = state.activeTarget) {
  const assessment = assessTarget(targetId);
  return {
    assessment,
    program: state.programs[targetId] || null,
    workouts: state.workouts.filter((item) => item.targetId === targetId).slice(-10),
    sets: state.sets.filter((item) => item.targetId === targetId).slice(-20),
    decisions: state.decisions.filter((item) => item.targetId === targetId).slice(-10),
  };
}

function adjustProgram(input = {}) {
  const targetId = input.targetId || state.activeTarget;
  const program = state.programs[targetId] || createProgram(targetId, { logDecision: false });
  const setDelta = clamp(input.setDelta ?? 0, -6, 6);
  const frequencyDelta = clamp(input.frequencyDelta ?? 0, -2, 2);
  const rirDelta = clamp(input.rirDelta ?? 0, -2, 2);
  program.weeklySets = clamp(program.weeklySets + setDelta, 3, 20);
  program.frequency = clamp(program.frequency + frequencyDelta, 1, state.profile.trainingDays);
  program.targetRir = clamp(program.targetRir + rirDelta, 0, 5);
  program.createdAt = Date.now();
  state.programs[targetId] = program;
  addDecision(targetId, 'Program manually adjusted', `Sets ${setDelta >= 0 ? '+' : ''}${setDelta}, frequency ${frequencyDelta >= 0 ? '+' : ''}${frequencyDelta}, RIR ${rirDelta >= 0 ? '+' : ''}${rirDelta}.`, assessTarget(targetId).status);
  saveState();
  return clone(program);
}

function getTrainingState(targetId = state.activeTarget) {
  return {
    activeTarget: targetId,
    target: targetInfo(targetId),
    profile: clone(state.profile),
    baseline: clone(baselineFor(targetId)),
    assessment: assessTarget(targetId),
    program: clone(state.programs[targetId] || null),
  };
}

function syncForm() {
  const targetId = state.activeTarget;
  const equipment = [...document.querySelectorAll('#equipmentGrid input:checked')].map((node) => node.value);
  state.profile.goal = $('goal').value;
  state.profile.trainingDays = clamp($('trainingDays').value, 1, 7);
  state.profile.sessionDuration = clamp($('sessionDuration').value, 20, 180);
  state.profile.readiness = clamp($('readiness').value, 1, 10);
  state.profile.soreness = clamp($('soreness').value, 0, 10);
  state.profile.sleepHours = clamp($('sleepHours').value, 0, 16);
  state.profile.equipment = equipment.length ? equipment : ['bodyweight'];
  state.baselines[targetId] = {
    frequency: clamp($('targetFrequency').value, 1, 7),
    directSets: clamp($('directSets').value, 0, 30),
    indirectSets: clamp($('indirectSets').value, 0, 30),
    loadKg: clamp($('loadKg').value, 0, 600),
    reps: clamp($('reps').value, 1, 100),
    rir: clamp($('rir').value, 0, 5),
    adherence: clamp($('adherence').value, 0, 100),
  };
}

function hydrateForm() {
  const baseline = baselineFor(state.activeTarget);
  $('targetSelect').value = state.activeTarget;
  $('goal').value = state.profile.goal;
  $('trainingDays').value = state.profile.trainingDays;
  $('sessionDuration').value = state.profile.sessionDuration;
  $('readiness').value = state.profile.readiness;
  $('soreness').value = state.profile.soreness;
  $('sleepHours').value = state.profile.sleepHours;
  $('targetFrequency').value = baseline.frequency;
  $('directSets').value = baseline.directSets;
  $('indirectSets').value = baseline.indirectSets;
  $('loadKg').value = baseline.loadKg;
  $('reps').value = baseline.reps;
  $('rir').value = baseline.rir;
  $('adherence').value = baseline.adherence;
  document.querySelectorAll('#equipmentGrid input').forEach((node) => { node.checked = state.profile.equipment.includes(node.value); });
}

function stateClass(status) {
  return String(status).toLowerCase().replaceAll('_', '-');
}

function render() {
  const assessment = assessTarget(state.activeTarget);
  const program = state.programs[state.activeTarget] || null;
  const badge = $('stateBadge');
  badge.className = `state-badge ${stateClass(assessment.status)}`;
  badge.textContent = assessment.status.replaceAll('_', ' ');
  $('decisionText').textContent = `${assessment.reason} ${assessment.action}`;
  $('e1rmMetric').textContent = assessment.latestE1rm ? `${assessment.latestE1rm} kg` : '—';
  $('e1rmDelta').textContent = assessment.trend === null ? 'No performance trend yet' : `${assessment.trend >= 0 ? '+' : ''}${round(assessment.trend * 100, 1)}% vs baseline`;
  $('exposureMetric').textContent = `${assessment.effectiveSets}`;
  $('frequencyMetric').textContent = `${assessment.frequency}×`;
  $('adherenceMetric').textContent = `${Math.round(assessment.adherence * 100)}%`;
  $('recoveryMetric').textContent = `${assessment.readiness}/10 · ${assessment.soreness}/10`;
  $('effortMetric').textContent = `${assessment.averageRir} RIR`;
  $('workoutCount').textContent = `${state.workouts.length} workout${state.workouts.length === 1 ? '' : 's'}`;

  if (!program) {
    $('programTitle').textContent = 'No recommendation yet';
    $('programEmpty').classList.remove('hidden');
    $('programContent').classList.add('hidden');
  } else {
    $('programTitle').textContent = `${TARGETS[program.targetId].label} · ${program.frequency}× weekly`;
    $('programEmpty').classList.add('hidden');
    $('programContent').classList.remove('hidden');
    $('programSummary').innerHTML = `
      <div class="summary-card"><span>Weekly target</span><strong>${program.weeklySets} sets</strong></div>
      <div class="summary-card"><span>Frequency</span><strong>${program.frequency} sessions</strong></div>
      <div class="summary-card"><span>Effort target</span><strong>${program.targetRir} RIR</strong></div>`;
    $('sessionList').innerHTML = program.sessions.map((session) => `
      <article class="session">
        <div class="session-head"><strong>${escapeHtml(session.name)}</strong><span>${session.exercises.reduce((sum, item) => sum + item.sets, 0)} working sets</span></div>
        ${session.exercises.map((exercise) => `
          <div class="program-line">
            <div><strong>${escapeHtml(exercise.name)}</strong><span>${escapeHtml(exercise.role)}</span></div>
            <div><strong>${exercise.sets} × ${escapeHtml(exercise.reps)}</strong><span>${exercise.rir} RIR</span></div>
          </div>`).join('')}
      </article>`).join('');
  }

  const logs = state.decisions.slice().reverse().slice(0, 8);
  $('decisionLog').innerHTML = logs.length ? logs.map((entry) => `
    <div class="log-entry">
      <time>${new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
      <div><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.detail)}</p></div>
      <span>${escapeHtml(TARGETS[entry.targetId]?.label || entry.targetId || 'Global')}</span>
    </div>`).join('') : '<div class="empty" style="min-height:110px">No decisions yet. Assess a target or let an agent update the state.</div>';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function manualAssess() {
  syncForm();
  const assessment = assessTarget(state.activeTarget);
  addDecision(state.activeTarget, `${assessment.status}: assessment`, `${assessment.reason} ${assessment.action}`, assessment.status);
  createProgram(state.activeTarget, { logDecision: false });
}

function logDemoWorkout() {
  syncForm();
  if (!state.programs[state.activeTarget]) createProgram(state.activeTarget, { logDecision: false });
  const baseline = baselineFor(state.activeTarget);
  const info = targetInfo(state.activeTarget);
  const improvedLoad = info.type === 'lift' && baseline.loadKg > 0 ? round(baseline.loadKg * 1.03, 1) : baseline.loadKg;
  completeWorkout({
    targetId: state.activeTarget,
    loadKg: improvedLoad,
    reps: baseline.reps,
    rir: Math.max(2, baseline.rir),
    readiness: Math.max(7, state.profile.readiness),
    soreness: Math.min(3, state.profile.soreness),
    sleepHours: Math.max(7, state.profile.sleepHours),
    note: 'Successful demo workout',
  });
}

function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  state = freshState();
  hydrateForm();
  render();
}

async function registerWebMCPTools() {
  const modelContext = document.modelContext;
  const status = $('webmcpStatus');
  if (!modelContext?.registerTool) {
    status.classList.add('unavailable');
    status.querySelector('span').textContent = 'WebMCP unavailable';
    return;
  }

  const targetEnum = Object.keys(TARGETS);
  const targetProperty = { type: 'string', enum: targetEnum, description: 'Training target identifier.' };
  const tools = [
    {
      name: 'get_training_state',
      description: 'Read the persistent training profile, baseline, assessment, and current program for a target.',
      inputSchema: { type: 'object', properties: { targetId: targetProperty } },
      annotations: { readOnlyHint: true },
      execute: async ({ targetId } = {}) => JSON.stringify(getTrainingState(targetId || state.activeTarget)),
    },
    {
      name: 'set_active_target',
      description: 'Change which lift or muscle target is active in the Workout Planner interface.',
      inputSchema: { type: 'object', properties: { targetId: targetProperty }, required: ['targetId'] },
      annotations: { readOnlyHint: false },
      execute: async ({ targetId }) => JSON.stringify(setActiveTarget(targetId)),
    },
    {
      name: 'update_training_profile',
      description: 'Update persistent schedule, equipment, recovery, performance baseline, volume, frequency, effort, or adherence data for a training target.',
      inputSchema: {
        type: 'object',
        properties: {
          targetId: targetProperty,
          goal: { type: 'string', enum: ['strength', 'hypertrophy', 'power'] },
          trainingDays: { type: 'number', minimum: 1, maximum: 7 },
          sessionDuration: { type: 'number', minimum: 20, maximum: 180 },
          equipment: { type: 'array', items: { type: 'string' } },
          frequency: { type: 'number', minimum: 1, maximum: 7 },
          directSets: { type: 'number', minimum: 0, maximum: 30 },
          indirectSets: { type: 'number', minimum: 0, maximum: 30 },
          loadKg: { type: 'number', minimum: 0, maximum: 600 },
          reps: { type: 'number', minimum: 1, maximum: 100 },
          rir: { type: 'number', minimum: 0, maximum: 5 },
          adherence: { type: 'number', minimum: 0, maximum: 100 },
          readiness: { type: 'number', minimum: 1, maximum: 10 },
          soreness: { type: 'number', minimum: 0, maximum: 10 },
          sleepHours: { type: 'number', minimum: 0, maximum: 16 },
        },
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => JSON.stringify(updateTrainingProfile(input)),
    },
    {
      name: 'assess_target',
      description: 'Assess a lift or muscle using performance trend, exposure, frequency, adherence, effort, and recovery. Returns a finite training state and rationale.',
      inputSchema: { type: 'object', properties: { targetId: targetProperty } },
      annotations: { readOnlyHint: true },
      execute: async ({ targetId } = {}) => JSON.stringify(assessTarget(targetId || state.activeTarget)),
    },
    {
      name: 'create_program',
      description: 'Build a deterministic focused program for a target from its current assessment and available equipment.',
      inputSchema: { type: 'object', properties: { targetId: targetProperty } },
      annotations: { readOnlyHint: false },
      execute: async ({ targetId } = {}) => JSON.stringify(createProgram(targetId || state.activeTarget)),
    },
    {
      name: 'get_program',
      description: 'Read the currently stored program for a training target.',
      inputSchema: { type: 'object', properties: { targetId: targetProperty } },
      annotations: { readOnlyHint: true },
      execute: async ({ targetId } = {}) => JSON.stringify(getProgram(targetId || state.activeTarget)),
    },
    {
      name: 'log_set',
      description: 'Log one performance set with exercise, load, reps, and RIR. Lift targets automatically calculate estimated one-rep max.',
      inputSchema: {
        type: 'object',
        properties: {
          targetId: targetProperty,
          exercise: { type: 'string' },
          loadKg: { type: 'number', minimum: 0, maximum: 600 },
          reps: { type: 'number', minimum: 1, maximum: 100 },
          rir: { type: 'number', minimum: 0, maximum: 5 },
        },
        required: ['reps'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => JSON.stringify(logSet(input)),
    },
    {
      name: 'complete_workout',
      description: 'Persist a completed target workout, optionally record performance and recovery, reassess the target, and adapt the next program.',
      inputSchema: {
        type: 'object',
        properties: {
          targetId: targetProperty,
          plannedSets: { type: 'number', minimum: 1, maximum: 40 },
          completedSets: { type: 'number', minimum: 0, maximum: 40 },
          exercise: { type: 'string' },
          loadKg: { type: 'number', minimum: 0, maximum: 600 },
          reps: { type: 'number', minimum: 1, maximum: 100 },
          rir: { type: 'number', minimum: 0, maximum: 5 },
          readiness: { type: 'number', minimum: 1, maximum: 10 },
          soreness: { type: 'number', minimum: 0, maximum: 10 },
          sleepHours: { type: 'number', minimum: 0, maximum: 16 },
          note: { type: 'string' },
        },
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => JSON.stringify(completeWorkout(input)),
    },
    {
      name: 'record_recovery',
      description: 'Record readiness, soreness, and sleep for a target so future programming can react to recovery constraints.',
      inputSchema: {
        type: 'object',
        properties: {
          targetId: targetProperty,
          readiness: { type: 'number', minimum: 1, maximum: 10 },
          soreness: { type: 'number', minimum: 0, maximum: 10 },
          sleepHours: { type: 'number', minimum: 0, maximum: 16 },
        },
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => JSON.stringify(recordRecovery(input)),
    },
    {
      name: 'get_progress',
      description: 'Read recent workouts, performance sets, decisions, assessment, and program for a target.',
      inputSchema: { type: 'object', properties: { targetId: targetProperty } },
      annotations: { readOnlyHint: true },
      execute: async ({ targetId } = {}) => JSON.stringify(getProgress(targetId || state.activeTarget)),
    },
    {
      name: 'adjust_program',
      description: 'Make an explicit bounded change to weekly sets, frequency, or target RIR without replacing the rest of the persistent training state.',
      inputSchema: {
        type: 'object',
        properties: {
          targetId: targetProperty,
          setDelta: { type: 'number', minimum: -6, maximum: 6 },
          frequencyDelta: { type: 'number', minimum: -2, maximum: 2 },
          rirDelta: { type: 'number', minimum: -2, maximum: 2 },
        },
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => JSON.stringify(adjustProgram(input)),
    },
  ];

  try {
    for (const tool of tools) await modelContext.registerTool(tool);
    status.classList.add('ready');
    status.querySelector('span').textContent = `${tools.length} WebMCP tools`;
  } catch (error) {
    console.error('WebMCP registration failed', error);
    status.classList.add('unavailable');
    status.querySelector('span').textContent = 'WebMCP registration failed';
  }
}

Object.entries(TARGETS).forEach(([id, target]) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = target.label;
  $('targetSelect').appendChild(option);
});

$('targetSelect').addEventListener('change', (event) => setActiveTarget(event.target.value));
$('assessButton').addEventListener('click', manualAssess);
$('generateButton').addEventListener('click', () => { syncForm(); createProgram(state.activeTarget); });
$('demoWorkoutButton').addEventListener('click', logDemoWorkout);
$('resetButton').addEventListener('click', resetDemo);

hydrateForm();
render();
registerWebMCPTools();
