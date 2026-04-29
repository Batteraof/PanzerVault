const { PermissionsBitField } = require('discord.js');
const roleCategoryService = require('./roleCategoryService');

async function setMemberCategoryRoles(member, category, selectedOptionKeys) {
  const botMember = member.guild.members.me;
  const options = await roleCategoryService.listCategoryOptions(member.guild.id, category.category_key);
  const selectedKeys = new Set(selectedOptionKeys || []);
  const selectedOptions = options.filter(option => selectedKeys.has(option.option_key));

  if (selectedOptions.length === 0) {
    return { ok: false, message: 'That role option is not available right now.' };
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return { ok: false, message: 'I do not have permission to manage roles.' };
  }

  const guildRoles = options
    .map(option => ({
      option,
      role: member.guild.roles.cache.get(option.role_id)
    }))
    .filter(item => item.role);

  const blocked = guildRoles.find(item => botMember.roles.highest.comparePositionTo(item.role) <= 0);
  if (blocked) {
    return { ok: false, message: `My role is too low to manage ${blocked.role}.` };
  }

  const added = [];
  const removed = [];
  const single = category.selection_mode !== 'multiple';

  for (const item of guildRoles) {
    const shouldHaveRole = selectedKeys.has(item.option.option_key);
    const hasRole = member.roles.cache.has(item.role.id);
    const shouldRemove = single ? !shouldHaveRole : false;

    if (shouldHaveRole && !hasRole) {
      await member.roles.add(item.role);
      added.push(item.role);
    }

    if (shouldRemove && hasRole) {
      await member.roles.remove(item.role);
      removed.push(item.role);
    }
  }

  return {
    ok: true,
    added,
    removed,
    selectedOptions
  };
}

async function clearMemberCategoryRoles(member, category) {
  const botMember = member.guild.members.me;
  const options = await roleCategoryService.listCategoryOptions(member.guild.id, category.category_key);

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return { ok: false, message: 'I do not have permission to manage roles.' };
  }

  const roles = options
    .map(option => member.guild.roles.cache.get(option.role_id))
    .filter(role => role && member.roles.cache.has(role.id));

  for (const role of roles) {
    if (botMember.roles.highest.comparePositionTo(role) <= 0) {
      return { ok: false, message: `My role is too low to remove ${role}.` };
    }
  }

  for (const role of roles) {
    await member.roles.remove(role);
  }

  return { ok: true, removed: roles };
}

module.exports = {
  clearMemberCategoryRoles,
  setMemberCategoryRoles
};
