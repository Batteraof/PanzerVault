const { PermissionsBitField } = require('discord.js');
const onboardingRoleService = require('./onboardingRoleService');

function isHelperEligibleSkill(skillOptionKey) {
  return ['medium', 'expert'].includes(skillOptionKey);
}

async function getMemberSkillRole(member) {
  const skillRoles = await onboardingRoleService.listRolesByGroup(member.guild.id, 'skill');
  return skillRoles.find(role => member.roles.cache.has(role.role_id)) || null;
}

async function memberHasHelperEligibleSkill(member) {
  const selectedSkill = await getMemberSkillRole(member);
  return Boolean(selectedSkill && isHelperEligibleSkill(selectedSkill.option_key));
}

async function setMemberSkillRole(member, skillOptionKey) {
  const botMember = member.guild.members.me;
  const skillRoles = await onboardingRoleService.listRolesByGroup(member.guild.id, 'skill');
  const selected = skillRoles.find(role => role.option_key === skillOptionKey);

  if (!selected) {
    return { ok: false, message: 'That skill role is not configured yet.' };
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return { ok: false, message: 'I do not have permission to manage roles.' };
  }

  const selectedRole = member.guild.roles.cache.get(selected.role_id);
  if (!selectedRole) {
    return { ok: false, message: 'The selected skill role no longer exists.' };
  }

  if (botMember.roles.highest.comparePositionTo(selectedRole) <= 0) {
    return { ok: false, message: 'My role is too low to assign that role.' };
  }

  const guildRoles = skillRoles
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
    skill: selected
  };
}

module.exports = {
  getMemberSkillRole,
  isHelperEligibleSkill,
  memberHasHelperEligibleSkill,
  setMemberSkillRole
};
