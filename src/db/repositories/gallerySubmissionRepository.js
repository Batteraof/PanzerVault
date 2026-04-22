const db = require('../client');

function executor(client) {
  return client || db;
}

async function createSubmission(data, client) {
  const result = await executor(client).query(
    `
    INSERT INTO gallery_submissions (
      guild_id,
      user_id,
      category,
      caption,
      video_link,
      target_channel_id,
      source_interaction_or_message_ref
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      data.guildId,
      data.userId,
      data.category,
      data.caption || null,
      data.videoLink || null,
      data.targetChannelId,
      data.sourceRef || null
    ]
  );

  return result.rows[0];
}

async function insertAssets(submissionId, assets, client) {
  const inserted = [];

  for (const asset of assets) {
    const result = await executor(client).query(
      `
      INSERT INTO gallery_assets (
        submission_id,
        attachment_url,
        filename,
        content_type,
        size_bytes,
        display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        submissionId,
        asset.url,
        asset.filename,
        asset.contentType || null,
        asset.size || null,
        asset.displayOrder
      ]
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}

async function attachTags(submissionId, tagIds, client) {
  for (const tagId of tagIds) {
    await executor(client).query(
      `
      INSERT INTO gallery_submission_tags (submission_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (submission_id, tag_id) DO NOTHING
      `,
      [submissionId, tagId]
    );
  }
}

async function updateGalleryMessageId(submissionId, messageId, client) {
  const result = await executor(client).query(
    `
    UPDATE gallery_submissions
    SET gallery_message_id = $2
    WHERE id = $1
    RETURNING *
    `,
    [submissionId, messageId]
  );

  return result.rows[0] || null;
}

async function markRemoved(submissionId, moderatorId, reason, client) {
  const result = await executor(client).query(
    `
    UPDATE gallery_submissions
    SET
      status = 'removed',
      removed_at = now(),
      removed_by = $2,
      removal_reason = $3
    WHERE id = $1
      AND status = 'posted'
    RETURNING *
    `,
    [submissionId, moderatorId || null, reason || null]
  );

  return result.rows[0] || null;
}

async function findById(guildId, submissionId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_submissions
    WHERE guild_id = $1 AND id = $2
    `,
    [guildId, submissionId]
  );

  return result.rows[0] || null;
}

async function findByMessageId(guildId, messageId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_submissions
    WHERE guild_id = $1 AND gallery_message_id = $2
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [guildId, messageId]
  );

  return result.rows[0] || null;
}

async function getAssets(submissionId, client) {
  const result = await executor(client).query(
    `
    SELECT *
    FROM gallery_assets
    WHERE submission_id = $1
    ORDER BY display_order ASC
    `,
    [submissionId]
  );

  return result.rows;
}

async function getTags(submissionId, client) {
  const result = await executor(client).query(
    `
    SELECT t.*
    FROM gallery_submission_tags st
    JOIN gallery_tags t ON t.id = st.tag_id
    WHERE st.submission_id = $1
    ORDER BY t.tag_name ASC
    `,
    [submissionId]
  );

  return result.rows;
}

async function countUserSubmissionsSince(guildId, userId, since, client) {
  const result = await executor(client).query(
    `
    SELECT COUNT(*)::integer AS count
    FROM gallery_submissions
    WHERE guild_id = $1
      AND user_id = $2
      AND created_at >= $3
    `,
    [guildId, userId, since]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

async function getUserSubmissionStats(guildId, userId, client) {
  const result = await executor(client).query(
    `
    SELECT
      COUNT(*)::integer AS total_submissions,
      COUNT(*) FILTER (WHERE status = 'posted')::integer AS posted_submissions,
      COUNT(*) FILTER (WHERE status = 'removed')::integer AS removed_submissions
    FROM gallery_submissions
    WHERE guild_id = $1 AND user_id = $2
    `,
    [guildId, userId]
  );

  return result.rows[0] || {
    total_submissions: 0,
    posted_submissions: 0,
    removed_submissions: 0
  };
}

module.exports = {
  createSubmission,
  insertAssets,
  attachTags,
  updateGalleryMessageId,
  markRemoved,
  findById,
  findByMessageId,
  getAssets,
  getTags,
  countUserSubmissionsSince,
  getUserSubmissionStats
};
