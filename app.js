const STORAGE_KEY = 'workout-planner.v1';

const MUSCLE_LABELS = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

const EXERCISES = {
  chest: [
    { name: 'Push-up', equipment: ['bodyweight'], reps: '8–20' },
    { name: 'Dumbbell floor press', equipment: ['dumbbells'], reps: '8–15' },
    { name: 'Dumbbell bench press', equipment: ['dumbbells', 'bench'], reps: '6–12' },
    { name: 'Barbell bench press', equipment: ['barbell', 'bench'], reps: '5–10' },
    { name: 'Cable chest press', equipment: ['cables'], reps: '8–15' },
    { name: 'Machine chest press', equipment: ['machines'], reps: '8–15' },
  ],
  back: [
    { name: 'Pull-up', equipment: ['pullup'], reps: '5–12' },
    { name: 'One-arm dumbbell row', equipment: ['dumbbells'], reps: '8–15' },
    { name: 'Barbell row', equipment: ['barbell'], reps: '6–12' },
    { name: 'Cable row', equipment: ['cables'], reps: '8–15' },
    { name: 'Machine row', equipment: ['machines'], reps: '8–15' },
  ],
  shoulders: [
    { name: 'Pike push-up', equipment: ['bodyweight'], reps: '6–15' },
    { name: 'Dumbbell overhead press', equipment: ['dumbbells'], reps: '6–12' },
    { name: 'Dumbbell lateral raise', equipment: ['dumbbells'], reps: '10–20' },
    { name: 'Barbell overhead press', equipment: ['barbell'], reps: '5–10' },
    { name: 'Cable lateral raise', equipment: ['cables'], reps: '10–20' },
    { name: 'Machine shoulder press', equipment: ['machines'], reps: '8–15' },
  ],
  biceps: [
    { name: 'Dumbbell curl', equipment: ['dumbbells'], reps: '8–15' },
    { name: 'Barbell curl', equipment: ['barbell'], reps: '6–12' },
    { name: 'Cable curl', equipment: ['cables'], reps: '10–15' },
    { name: 'Machine curl', equipment: ['machines'], reps: '8–15' },
  ],
  triceps: [
    { name: 'Close-grip push-up', equipment: ['bodyweight'], reps: '8–20' },
    { name: 'Dumbbell overhead extension', equipment: ['dumbbells'], reps: '8–15' },
    { name: 'Close-grip bench press', equipment: ['barbell', 'bench'], reps: '6–12' },
    { name: 'Cable pressdown', equipment: ['cables'], reps: '10–20' },
    { name: 'Machine dip', equipment: ['machines'], reps: '8–15' },
  ],
  quads: [
    { name: 'Split squat', equipment: ['bodyweight'], reps: '8–15 / leg' },
    { name: 'Goblet squat', equipment: ['dumbbells'], reps: '8–15' },
    { name: 'Front squat', equipment: ['barbell'], reps: '5–10' },
    { name: 'Cable reverse lunge', equipment: ['cables'], reps: '8–15 / leg' },
    { name: 'Leg press', equipment: ['machines'], reps: '8–15' },
  ],
  hamstrings: [
    { name: 'Single-leg hip hinge', equipment: ['bodyweight'], reps: '8–15 / leg' },
    { name: 'Dumbbell Romanian deadlift', equipment: ['dumbbells'], reps: '6–12' },
    { name: 'Romanian deadlift', equipment: ['barbell'], reps: '5–10' },
    { name: 'Cable pull-through', equipment: ['cables'], reps: '10–15' },
    { name: 'Leg curl', equipment: ['machines'], reps: '8–15' },
  ],
  glutes: [
    { name: 'Single-leg glute bridge', equipment: ['bodyweight'], reps: '10–20' },
    { name: 'Dumbbell hip thrust', equipment: ['dumbbells', 'bench'], reps: '8–15' },
    { name: 'Barbell hip thrust', equipment: ['barbell', 'bench'], reps: '6–12' },
    { name: 'Cable pull-through', equipment: ['cables'], reps: '10–15' },
    { name: 'Hip thrust machine', equipment: ['machines'], reps: '8–15' },
  ],
  calves: [
    { name: 'Single-leg calf raise', equipment: ['bodyweight'], reps: '12–25' },
    { name: 'Dumbbell calf raise', equipment: ['dumbbells'], reps: '10–20' },
    { name: 'Barbell calf raise', equipment: ['barbell'], reps: '8–20' },
    { name: 'Machine calf raise', equipment: ['machines'], reps: '10–20' },
  ],
};

const defaultState = () => ({
  profile: {
    targetMuscle: 'chest',
    equipment: ['bodyweight', 'dumbbells'],
    trainingDays: 3,
    sessionDuration: 45,
    directSets: 4,
    indirectSets: 2,
    rir: 2,
    soreness: 2,
  },
  routine: null,
  logs: [],
  setLogs: [],
  lastAssessment: null,
});

let state = loadState();

const el = (id) => document.getElementById(id);

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.profile ? saved : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function recentWorkoutLogs(muscle) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return state.logs.filter((log) => log.muscle === muscle && log.timestamp >= cutoff);
}

function observedMetrics(muscle) {
  const logs = recentWorkoutLogs(muscle);
  const completedSets = logs.reduce((sum, log) => sum + log.completedSets, 0);
  const completionRate = logs.length
    ? logs.reduce((sum, log) => sum + log.completionRate, 0) / logs.length
    : 1;
  const averageRir = logs.length
    ? logs.reduce((sum, log) => sum + log.rir, 0) / logs.length
    : state.profile.rir;
  const soreness = logs.length ? logs[logs.length - 1].soreness : state.profile.soreness;

  const performanceLogs = logs.filter((log) => Number.isFinite(log.performanceIndex));
  let progression = 0;
  if (performanceLogs.length >= 2) {
    const previous = performanceLogs[performanceLogs.length - 2].performanceIndex;
    const current = performanceLogs[performanceLogs.length - 1].performanceIndex;
    progression = previous > 0 ? (current - previous) / previous : 0;
  }

  return { logs, completedSets, completionRate, averageRir, soreness, progression };
}

function assessMuscleGroup(muscle = state.profile.targetMuscle) {
  const metrics = observedMetrics(muscle);
  const baselineDirect = muscle === state.profile.targetMuscle ? state.profile.directSets : 0;
  const baselineIndirect = muscle === state.profile.targetMuscle ? state.profile.indirectSets : 0;
  const effectiveSets = baselineDirect + baselineIndirect * 0.5 + metrics.completedSets;

  let muscleState = 'ADEQUATE';
  let reason = 'Training exposure and recovery signals are inside the working range.';

  if (metrics.soreness >= 7 || metrics.completionRate < 0.65) {
    muscleState = 'RECOVERY_LIMITED';
    reason = 'Recovery or completion is too poor to justify more volume.';
  } else if (effectiveSets < 8) {
    muscleState = 'UNDERTRAINED';
    reason = 'Effective weekly exposure is below the minimum target used by this demo engine.';
  } else if (metrics.logs.length >= 2 && metrics.progression <= 0.01) {
    muscleState = 'STALLED';
    reason = 'Exposure is sufficient, but recent performance has not improved.';
  } else if (metrics.logs.length >= 2 && metrics.progression > 0.01 && metrics.completionRate >= 0.8) {
    muscleState = 'PROGRESSING';
    reason = 'Recent performance improved while completion and recovery remained acceptable.';
  }

  return {
    muscle,
    label: MUSCLE_LABELS[muscle] || muscle,
    state: muscleState,
    effectiveSets: Number(effectiveSets.toFixed(1)),
    baselineDirect,
    baselineIndirect,
    loggedSetsLast7Days: metrics.completedSets,
    completionRate: Number(metrics.completionRate.toFixed(2)),
    averageRir: Number(metrics.averageRir.toFixed(1)),
    soreness: Number(metrics.soreness),
    progression: Number(metrics.progression.toFixed(3)),
    reason,
  };
}

function exerciseAvailable(exercise, equipment) {
  return exercise.equipment.every((required) => equipment.includes(required));
}

function pickExercises(muscle, equipment, count = 2) {
  const available = (EXERCISES[muscle] || []).filter((exercise) => exerciseAvailable(exercise, equipment));
  if (available.length) return available.slice(0, count);
  return [{ name: `${MUSCLE_LABELS[muscle]} movement`, equipment: [], reps: '8–15' }];
}

function targetVolumeFor(assessment) {
  const current = assessment.effectiveSets;
  switch (assessment.state) {
    case 'UNDERTRAINED': return clamp(Math.ceil(current + 4), 8, 12);
    case 'RECOVERY_LIMITED': return clamp(Math.floor(current - 2), 6, 10);
    case 'STALLED': return clamp(Math.round(current), 8, 14);
    case 'PROGRESSING': return clamp(Math.ceil(current + 1), 8, 16);
    default: return clamp(Math.round(current), 8, 12);
  }
}

function createRoutine(muscle = state.profile.targetMuscle) {
  const assessment = assessMuscleGroup(muscle);
  const targetWeeklySets = targetVolumeFor(assessment);
  const frequency = Math.min(state.profile.trainingDays, targetWeeklySets >= 10 ? 2 : 1);
  const setsPerSession = Math.max(3, Math.ceil(targetWeeklySets / Math.max(1, frequency)));
  const exerciseCount = state.profile.sessionDuration < 30 ? 1 : 2;
  const exercises = pickExercises(muscle, state.profile.equipment, exerciseCount);

  let remaining = setsPerSession;
  const prescription = exercises.map((exercise, index) => {
    const slotsLeft = exercises.length - index;
    const sets = Math.max(1, Math.ceil(remaining / slotsLeft));
    remaining -= sets;
    return { ...exercise, sets, rir: assessment.state === 'RECOVERY_LIMITED' ? 3 : 2 };
  });

  state.routine = {
    id: `routine-${Date.now()}`,
    muscle,
    createdAt: Date.now(),
    sourceState: assessment.state,
    targetWeeklySets,
    frequency,
    setsPerSession,
    exercises: prescription,
  };
  state.lastAssessment = assessment;
  saveState();
  return state.routine;
}

function getRoutine() {
  return state.routine;
}

function logSet({ exercise, reps, loadKg = 0, rir = state.profile.rir, muscle = state.profile.targetMuscle }) {
  const entry = {
    id: `set-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    muscle,
    exercise: String(exercise || 'Unknown exercise'),
    reps: clamp(reps || 0, 0, 100),
    loadKg: clamp(loadKg || 0, 0, 1000),
    rir: clamp(rir, 0, 5),
  };
  state.setLogs.push(entry);
  saveState();
  return entry;
}

function completeWorkout({ completedSets, plannedSets, rir, soreness, performanceIndex } = {}) {
  if (!state.routine) throw new Error('Create a routine before completing a workout.');

  const previousAssessment = assessMuscleGroup(state.routine.muscle);
  const planned = clamp(plannedSets ?? state.routine.setsPerSession, 1, 40);
  const completed = clamp(completedSets ?? planned, 0, planned);
  const perceivedRir = clamp(rir ?? state.profile.rir, 0, 5);
  const perceivedSoreness = clamp(soreness ?? state.profile.soreness, 0, 10);

  const entry = {
    id: `workout-${Date.now()}`,
    timestamp: Date.now(),
    muscle: state.routine.muscle,
    routineId: state.routine.id,
    plannedSets: planned,
    completedSets: completed,
    completionRate: planned ? completed / planned : 0,
    rir: perceivedRir,
    soreness: perceivedSoreness,
    performanceIndex: Number.isFinite(Number(performanceIndex)) ? Number(performanceIndex) : null,
  };

  state.logs.push(entry);
  state.profile.rir = perceivedRir;
  state.profile.soreness = perceivedSoreness;

  const newAssessment = assessMuscleGroup(state.routine.muscle);
  const previousRoutine = { ...state.routine };
  state.lastAssessment = newAssessment;
  saveState();
  const nextRoutine = createRoutine(state.profile.targetMuscle);

  return {
    workout: entry,
    previousState: previousAssessment.state,
    newState: newAssessment.state,
    previousWeeklyTarget: previousRoutine.targetWeeklySets,
    nextWeeklyTarget: nextRoutine.targetWeeklySets,
    assessment: newAssessment,
  };
}

function updateConstraints(input = {}) {
  if (Array.isArray(input.equipment) && input.equipment.length) {
    state.profile.equipment = input.equipment.filter((item) => typeof item === 'string');
  }
  if (input.trainingDays !== undefined) state.profile.trainingDays = clamp(input.trainingDays, 1, 7);
  if (input.sessionDuration !== undefined) state.profile.sessionDuration = clamp(input.sessionDuration, 15, 180);
  if (input.directSets !== undefined) state.profile.directSets = clamp(input.directSets, 0, 30);
  if (input.indirectSets !== undefined) state.profile.indirectSets = clamp(input.indirectSets, 0, 30);
  if (input.rir !== undefined) state.profile.rir = clamp(input.rir, 0, 5);
  if (input.soreness !== undefined) state.profile.soreness = clamp(input.soreness, 0, 10);
  if (input.targetMuscle && MUSCLE_LABELS[input.targetMuscle]) state.profile.targetMuscle = input.targetMuscle;
  saveState();
  return { ...state.profile };
}

function getProgress(muscle = state.profile.targetMuscle) {
  const assessment = assessMuscleGroup(muscle);
  const logs = state.logs.filter((log) => log.muscle === muscle);
  return {
    assessment,
    completedWorkouts: logs.length,
    completedSets: logs.reduce((sum, log) => sum + log.completedSets, 0),
    recentWorkouts: logs.slice(-5),
  };
}

function adjustVolume({ direction = 'hold', sets = 2 } = {}) {
  const amount = clamp(sets, 1, 6);
  if (direction === 'increase') state.profile.directSets = clamp(state.profile.directSets + amount, 0, 30);
  if (direction === 'decrease') state.profile.directSets = clamp(state.profile.directSets - amount, 0, 30);
  saveState();
  const routine = createRoutine(state.profile.targetMuscle);
  return { direction, directSets: state.profile.directSets, routine };
}

function syncFormToState() {
  const equipment = [...document.querySelectorAll('#equipmentGrid input:checked')].map((input) => input.value);
  updateConstraints({
    targetMuscle: el('targetMuscle').value,
    equipment: equipment.length ? equipment : ['bodyweight'],
    trainingDays: el('trainingDays').value,
    sessionDuration: el('sessionDuration').value,
    directSets: el('directSets').value,
    indirectSets: el('indirectSets').value,
    rir: el('rir').value,
    soreness: el('soreness').value,
  });
}

function hydrateForm() {
  const profile = state.profile;
  el('targetMuscle').value = profile.targetMuscle;
  el('trainingDays').value = profile.trainingDays;
  el('sessionDuration').value = profile.sessionDuration;
  el('directSets').value = profile.directSets;
  el('indirectSets').value = profile.indirectSets;
  el('rir').value = profile.rir;
  el('soreness').value = profile.soreness;
  document.querySelectorAll('#equipmentGrid input').forEach((input) => {
    input.checked = profile.equipment.includes(input.value);
  });
}

function addMessage(role, text) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  const label = role === 'assistant' ? 'ALEXA+' : 'YOU';
  message.innerHTML = `<span class="message-meta">${label}</span>${escapeHtml(text)}`;
  el('messages').appendChild(message);
  el('messages').parentElement.scrollTop = el('messages').parentElement.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  const assessment = assessMuscleGroup(state.profile.targetMuscle);
  el('muscleState').textContent = assessment.state;
  el('effectiveSets').textContent = `${assessment.effectiveSets} effective sets`;
  el('completedCount').textContent = state.logs.length;

  if (!state.routine) {
    el('routineEmpty').classList.remove('hidden');
    el('routineCard').classList.add('hidden');
    return;
  }

  el('routineEmpty').classList.add('hidden');
  el('routineCard').classList.remove('hidden');
  el('weeklyTarget').textContent = `${state.routine.targetWeeklySets} sets`;
  el('frequency').textContent = `${state.routine.frequency}× / week`;
  el('sessionSets').textContent = `${state.routine.setsPerSession} sets`;
  el('exerciseList').innerHTML = state.routine.exercises.map((exercise) => `
    <div class="exercise">
      <div>
        <strong>${escapeHtml(exercise.name)}</strong>
        <span>${exercise.sets} sets · ${escapeHtml(exercise.reps)}</span>
      </div>
      <div>
        <strong>${exercise.rir} RIR</strong>
        <span>target effort</span>
      </div>
    </div>
  `).join('');
}

function handleAnalyze() {
  syncFormToState();
  const assessment = assessMuscleGroup();
  const routine = createRoutine();
  addMessage('user', `${assessment.label} feels behind. I have ${state.profile.trainingDays} training days and about ${state.profile.sessionDuration} minutes per session.`);
  addMessage(
    'assistant',
    `${assessment.label} is ${assessment.state}. Effective exposure is ${assessment.effectiveSets} sets per week. ${assessment.reason}\n\nI set the target to ${routine.targetWeeklySets} weekly sets across ${routine.frequency} focused session${routine.frequency === 1 ? '' : 's'}.`
  );
}

function handleComplete() {
  const before = assessMuscleGroup();
  const result = completeWorkout();
  addMessage('user', `Workout complete: ${result.workout.completedSets} of ${result.workout.plannedSets} planned sets.`);
  const adaptation = result.previousWeeklyTarget === result.nextWeeklyTarget
    ? `The next weekly target stays at ${result.nextWeeklyTarget} sets.`
    : `The next weekly target changes from ${result.previousWeeklyTarget} to ${result.nextWeeklyTarget} sets.`;
  addMessage(
    'assistant',
    `Logged. ${before.label} moved from ${before.state} to ${result.newState}. ${adaptation}`
  );
}

function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  el('messages').innerHTML = '';
  hydrateForm();
  render();
  addMessage('assistant', 'Which muscle group feels behind? Give me your equipment and current weekly exposure. I will only adjust the targeted work.');
}

async function registerWebMCPTools() {
  const modelContext = document.modelContext || navigator.modelContext;
  const status = el('webmcpStatus');

  if (!modelContext?.registerTool) {
    status.classList.add('unavailable');
    status.querySelector('span:last-child').textContent = 'WebMCP unavailable';
    return;
  }

  const tools = [
    {
      name: 'assess_muscle_group',
      description: 'Assess the current training state of a muscle group using local workout exposure and recovery data.',
      inputSchema: { type: 'object', properties: { muscle: { type: 'string', enum: Object.keys(MUSCLE_LABELS) } } },
      annotations: { readOnlyHint: true },
      execute: ({ muscle } = {}) => assessMuscleGroup(muscle || state.profile.targetMuscle),
    },
    {
      name: 'create_routine',
      description: 'Create or replace the targeted routine using deterministic local programming logic.',
      inputSchema: { type: 'object', properties: { muscle: { type: 'string', enum: Object.keys(MUSCLE_LABELS) } } },
      annotations: { readOnlyHint: false },
      execute: ({ muscle } = {}) => createRoutine(muscle || state.profile.targetMuscle),
    },
    {
      name: 'get_routine',
      description: 'Return the currently stored workout routine.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => getRoutine(),
    },
    {
      name: 'log_set',
      description: 'Persist one completed set locally for later progress analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          exercise: { type: 'string' },
          reps: { type: 'number' },
          loadKg: { type: 'number' },
          rir: { type: 'number', minimum: 0, maximum: 5 },
          muscle: { type: 'string', enum: Object.keys(MUSCLE_LABELS) },
        },
        required: ['exercise', 'reps'],
      },
      annotations: { readOnlyHint: false },
      execute: (input) => logSet(input),
    },
    {
      name: 'complete_workout',
      description: 'Complete the active workout, persist results, reassess the target muscle, and adapt the next routine.',
      inputSchema: {
        type: 'object',
        properties: {
          completedSets: { type: 'number', minimum: 0 },
          plannedSets: { type: 'number', minimum: 1 },
          rir: { type: 'number', minimum: 0, maximum: 5 },
          soreness: { type: 'number', minimum: 0, maximum: 10 },
          performanceIndex: { type: 'number' },
        },
      },
      annotations: { readOnlyHint: false },
      execute: (input) => completeWorkout(input),
    },
    {
      name: 'update_constraints',
      description: 'Update local equipment, schedule, exposure, effort, recovery, or target-muscle constraints.',
      inputSchema: {
        type: 'object',
        properties: {
          targetMuscle: { type: 'string', enum: Object.keys(MUSCLE_LABELS) },
          equipment: { type: 'array', items: { type: 'string' } },
          trainingDays: { type: 'number', minimum: 1, maximum: 7 },
          sessionDuration: { type: 'number', minimum: 15, maximum: 180 },
          directSets: { type: 'number', minimum: 0, maximum: 30 },
          indirectSets: { type: 'number', minimum: 0, maximum: 30 },
          rir: { type: 'number', minimum: 0, maximum: 5 },
          soreness: { type: 'number', minimum: 0, maximum: 10 },
        },
      },
      annotations: { readOnlyHint: false },
      execute: (input) => updateConstraints(input),
    },
    {
      name: 'get_progress',
      description: 'Return stored progress and the current deterministic assessment for a muscle group.',
      inputSchema: { type: 'object', properties: { muscle: { type: 'string', enum: Object.keys(MUSCLE_LABELS) } } },
      annotations: { readOnlyHint: true },
      execute: ({ muscle } = {}) => getProgress(muscle || state.profile.targetMuscle),
    },
    {
      name: 'adjust_volume',
      description: 'Explicitly increase, decrease, or hold the reported direct weekly volume and rebuild the routine.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['increase', 'decrease', 'hold'] },
          sets: { type: 'number', minimum: 1, maximum: 6 },
        },
        required: ['direction'],
      },
      annotations: { readOnlyHint: false },
      execute: (input) => adjustVolume(input),
    },
  ];

  try {
    await Promise.all(tools.map((tool) => modelContext.registerTool(tool)));
    status.classList.add('ready');
    status.querySelector('span:last-child').textContent = `${tools.length} WebMCP tools ready`;
  } catch (error) {
    console.error('WebMCP registration failed', error);
    status.classList.add('unavailable');
    status.querySelector('span:last-child').textContent = 'WebMCP registration failed';
  }
}

el('analyzeButton').addEventListener('click', handleAnalyze);
el('completeButton').addEventListener('click', handleComplete);
el('resetButton').addEventListener('click', resetDemo);

hydrateForm();
render();
addMessage('assistant', state.routine
  ? `Welcome back. Your ${MUSCLE_LABELS[state.profile.targetMuscle].toLowerCase()} routine is still stored locally.`
  : 'Which muscle group feels behind? Give me your equipment and current weekly exposure. I will only adjust the targeted work.');
registerWebMCPTools();
