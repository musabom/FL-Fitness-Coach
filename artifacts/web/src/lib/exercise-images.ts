// Exercise name to image URL mapping
export const EXERCISE_IMAGES: Record<string, string> = {
  // Legs
  "Leg Extension": "/exercises/leg-extension.png",
  "Squats": "/exercises/squats.png",
  "Hack Squats": "/exercises/hack-squats.png",
  "Leg Press": "/exercises/leg-press.png",
  "Leg Curls": "/exercises/leg-curls.png",
  "Lunges": "/exercises/lunges.png",
  "Hip Adductor Machine": "/exercises/hip-adductor-machine.png",
  "Calf Raise Machine": "/exercises/calf-raise-machine.png",
  
  // Shoulders
  "Front Raises": "/exercises/front-raises.png",
  "Shoulder Press Machine": "/exercises/shoulder-press-machine.png",
  "Dumbbell Shoulder Press": "/exercises/dumbbell-shoulder-press.png",
  "Lateral Raises": "/exercises/lateral-raises.png",
  "Plate Front Raise": "/exercises/plate-front-raise.png",
  "Rear Delt Fly Machine": "/exercises/rear-delt-fly-machine.png",
  "Barbell Shrugs": "/exercises/barbell-shrugs.png",
  "Dumbbell Shrugs": "/exercises/dumbbell-shrugs.png",
  
  // Triceps
  "Tricep Pushdown Reverse Grip": "/exercises/reverse-grip-tricep-pushdown.png",
  "Tricep Pushdown Rope": "/exercises/tricep-pushdown-straight-rope.png",
  "Tricep Pushdown Straight Bar": "/exercises/tricep-pushdown-straight-bar.png",
  "Overhead Tricep Extension": "/exercises/overhead-tricep-extension.png",
};

export function getExerciseImageUrl(exerciseName: string): string | null {
  return EXERCISE_IMAGES[exerciseName] || null;
}
