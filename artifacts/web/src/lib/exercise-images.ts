// Exercise name to image URL mapping
export const EXERCISE_IMAGES: Record<string, string> = {
  // Legs
  "Leg Extension": "/exercises/1-leg_extension_1773909454018.png",
  "Squats": "/exercises/2-_Squats_1773909454017.png",
  "Hack Squats": "/exercises/2-hack_squats_1773909454017.png",
  "Leg Press": "/exercises/3-leg_press_1773909454016.png",
  "Leg Curls": "/exercises/4-Leg_Curls_1773909454017.png",
  "Lunges": "/exercises/lunges.png",
  "Hip Adductor Machine": "/exercises/hip-adductor-machine.png",
  "Calf Raise Machine": "/exercises/calf-raise-machine.png",
  
  // Shoulders
  "Front Raises": "/exercises/1-_front_raises_1773909535480.png",
  "Shoulder Press Machine": "/exercises/2-_shoulder_press_machine_1773909535480.png",
  "Dumbbell Shoulder Press": "/exercises/2-_dumbbell_shoulder_press_1773909535480.png",
  "Lateral Raises": "/exercises/3-_lateral_side_raises_1773909454019.png",
  "Plate Front Raise": "/exercises/4-_plate_front_raise_1773909535480.png",
  "Rear Delt Fly Machine": "/exercises/rear-delt-fly-machine.png",
  "Barbell Shrugs": "/exercises/barbell-shrugs.png",
  "Dumbbell Shrugs": "/exercises/dumbbell-shrugs.png",
  
  // Back
  "Lat Pulldown": "/exercises/1-_lat_pulldown_1773910065653.png",
  "Dumbbell Row": "/exercises/2-Dumbbell_row_1773910065654.png",
  "Seated Row Machine": "/exercises/2-Seated_row_machine_1773910065654.png",
  "T-bar Row": "/exercises/5-T-bar_row_1773910065651.png",
  "Back Extension": "/exercises/6-back_extension_1773910065652.png",
  "Close Grip Lat Pulldown": "/exercises/3-close_grip_lat_pulldown_1773910065652.png",
  "Seat Cable Row": "/exercises/4-seat_cable_row_1773910065653.png",
  
  // Biceps
  "Biceps Curl": "/exercises/1-biceps_curl_alternating_dumbbell_1773910065654.png",
  "Hammer Curl": "/exercises/3-hammer_curl_1773910065654.png",
  "Concentrated Curl": "/exercises/4-concentrated_curl_1773910065654.png",
  "Barbell Biceps Curl": "/exercises/2-barbell_biceps_curl_1773910065656.png",
  
  // Chest
  "Barbell Bench Press": "/exercises/1-_barbell_bench_press_1773910065656.png",
  "Machine Chest Press": "/exercises/2-_Machine_chest_press_1773910065656.png",
  "Dumbbell Press": "/exercises/2-Dumbbell_press_1773910065654.png",
  "Decline Chest Press Machine": "/exercises/3-_decline_chest_press_machine_1773910065655.png",
  "Incline Chest Press Machine": "/exercises/5-_incline_chest_press_machine_1773910065655.png",
  "Machine Chest Fly": "/exercises/6-_machine_chest_fly_1773910065655.png",
  
  // Triceps
  "Tricep Pushdown Reverse Grip": "/exercises/1-_reverse_grip_tricep_pushdown_1773909535481.png",
  "Tricep Pushdown Rope": "/exercises/2-tricep_pushdown_straight_rope_1773909535482.png",
  "Tricep Pushdown Straight Bar": "/exercises/3-_tricep_pushdown_straight_bar_1773909535481.png",
  "Overhead Tricep Extension": "/exercises/4-_overhead_tricep_extension_1773909535481.png",
};

export function getExerciseImageUrl(exerciseName: string): string | null {
  return EXERCISE_IMAGES[exerciseName] || null;
}
