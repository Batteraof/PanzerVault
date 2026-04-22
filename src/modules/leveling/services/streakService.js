const { STREAK_WINDOW_MS } = require('../constants/levelingConfig');

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateNextStreak(user, activityAt = new Date()) {
  const previousActivity = toDate(user.last_activity_at);
  const lastStreakAt = toDate(user.last_streak_at);

  if (!previousActivity || !lastStreakAt || user.streak_count <= 0) {
    return {
      streakCount: 1,
      lastActivityAt: activityAt,
      lastStreakAt: activityAt,
      changed: true,
      reset: false
    };
  }

  const inactiveForMs = activityAt.getTime() - previousActivity.getTime();
  if (inactiveForMs > STREAK_WINDOW_MS) {
    return {
      streakCount: 1,
      lastActivityAt: activityAt,
      lastStreakAt: activityAt,
      changed: true,
      reset: true
    };
  }

  const sinceLastStreakMs = activityAt.getTime() - lastStreakAt.getTime();
  if (sinceLastStreakMs >= STREAK_WINDOW_MS) {
    return {
      streakCount: Number(user.streak_count) + 1,
      lastActivityAt: activityAt,
      lastStreakAt: activityAt,
      changed: true,
      reset: false
    };
  }

  return {
    streakCount: Number(user.streak_count),
    lastActivityAt: activityAt,
    lastStreakAt,
    changed: false,
    reset: false
  };
}

module.exports = {
  calculateNextStreak
};
