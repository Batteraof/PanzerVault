const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const customIds = require('./customIds');
const roleCategoryService = require('../modules/config/services/roleCategoryService');

function categorySelectCustomId(categoryKey) {
  return `${customIds.ROLE_CATEGORY_SELECT}:${categoryKey}`;
}

async function buildRoleCategoryPicker(guildId, category) {
  const options = await roleCategoryService.listCategoryOptions(guildId, category.category_key);

  if (options.length === 0) {
    return {
      content: `No ${category.label.toLowerCase()} roles are configured yet.`,
      components: []
    };
  }

  const visibleOptions = options.slice(0, 25);
  const multiple = category.selection_mode === 'multiple';
  const menu = new StringSelectMenuBuilder()
    .setCustomId(categorySelectCustomId(category.category_key))
    .setPlaceholder(`Choose ${category.label}`)
    .setMinValues(1)
    .setMaxValues(multiple ? visibleOptions.length : 1)
    .addOptions(
      visibleOptions.map(option => ({
        label: option.label,
        value: option.option_key
      }))
    );

  const extraNote = options.length > visibleOptions.length
    ? '\nOnly the first 25 options are shown. Ask staff to adjust the category ordering.'
    : '';

  return {
    content: `${category.description || `Choose your ${category.label.toLowerCase()} role.`}${extraNote}`,
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

module.exports = {
  buildRoleCategoryPicker,
  categorySelectCustomId
};
