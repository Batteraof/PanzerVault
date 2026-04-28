const { PermissionsBitField } = require('discord.js');
const teamRoleService = require('./teamRoleService');

async function setMemberTeamRole(member, teamOptionKey) {
  const botMember = member.guild.members.me;
  const teamRoles = await teamRoleService.listTeamRoles(member.guild.id);
  const selected = teamRoles.find(role => role.option_key === teamOptionKey);

  if (!selected) {
    return { ok: false, message: 'That team role is not available right now.' };
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return { ok: false, message: 'I do not have permission to manage roles.' };
  }

  const selectedRole = member.guild.roles.cache.get(selected.role_id);
  if (!selectedRole) {
    return { ok: false, message: 'The selected team role no longer exists.' };
  }

  if (botMember.roles.highest.comparePositionTo(selectedRole) <= 0) {
    return { ok: false, message: 'My role is too low to assign that team role.' };
  }

  const guildRoles = teamRoles
    .map(role => member.guild.roles.cache.get(role.role_id))
    .filter(Boolean);

  for (const role of guildRoles) {
    if (role.id !== selectedRole.id && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
    }
  }

  if (!member.roles.cache.has(selectedRole.id)) {
    await member.roles.add(selectedRole);
  }

  return {
    ok: true,
    role: selectedRole,
    team: selected
  };
}

module.exports = {
  setMemberTeamRole
};
