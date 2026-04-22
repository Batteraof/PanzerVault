const {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const configCommandService = require('../modules/admin/services/configCommandService');
const logger = require('../logger');

const textChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const categoryChannelTypes = [ChannelType.GuildCategory];

function addChannelOption(subcommand, description) {
  return subcommand.addChannelOption(option =>
    option
      .setName('channel')
      .setDescription(description)
      .setRequired(true)
      .addChannelTypes(...textChannelTypes)
  );
}

function addEnabledOption(subcommand) {
  return subcommand.addBooleanOption(option =>
    option
      .setName('enabled')
      .setDescription('Whether this system should be enabled.')
      .setRequired(true)
  );
}

function addTagCategoryOption(subcommand) {
  return subcommand.addStringOption(option =>
    option
      .setName('category')
      .setDescription('Optional category restriction for this tag.')
      .setRequired(false)
      .addChoices(
        { name: 'All categories', value: 'all' },
        { name: 'Showcase', value: 'showcase' },
        { name: 'Meme', value: 'meme' }
      )
  );
}

function addRoleOption(subcommand, description) {
  return subcommand.addRoleOption(option =>
    option
      .setName('role')
      .setDescription(description)
      .setRequired(true)
  );
}

function errorMessage(error) {
  logger.warn('Config command failed', error);
  return error.message || 'Something went wrong while updating config.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Admin configuration for bot systems.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup(group =>
      group
        .setName('welcome')
        .setDescription('Configure welcome messages.')
        .addSubcommand(subcommand =>
          addChannelOption(
            subcommand
              .setName('channel')
              .setDescription('Set the welcome message channel.'),
            'Channel for welcome messages.'
          )
        )
        .addSubcommand(subcommand =>
          addEnabledOption(
            subcommand
              .setName('enabled')
              .setDescription('Enable or disable welcome messages.')
          )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('leveling')
        .setDescription('Configure leveling.')
        .addSubcommand(subcommand =>
          addChannelOption(
            subcommand
              .setName('channel')
              .setDescription('Set the level-up announcement channel.'),
            'Channel for level-up announcements.'
          )
        )
        .addSubcommand(subcommand =>
          addEnabledOption(
            subcommand
              .setName('enabled')
              .setDescription('Enable or disable leveling.')
          )
        )
        .addSubcommand(subcommand =>
          addEnabledOption(
            subcommand
              .setName('text-xp')
              .setDescription('Enable or disable text XP.')
          )
        )
        .addSubcommand(subcommand =>
          addEnabledOption(
            subcommand
              .setName('voice-xp')
              .setDescription('Enable or disable voice XP.')
          )
        )
        .addSubcommand(subcommand =>
          addEnabledOption(
            subcommand
              .setName('dm-levelups')
              .setDescription('Enable or disable level-up DMs.')
          )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('gallery')
        .setDescription('Configure gallery channels and tags.')
        .addSubcommand(subcommand =>
          addChannelOption(
            subcommand
              .setName('showcase-channel')
              .setDescription('Set the showcase gallery channel.'),
            'Channel for showcase gallery posts.'
          )
        )
        .addSubcommand(subcommand =>
          addChannelOption(
            subcommand
              .setName('meme-channel')
              .setDescription('Set the meme gallery channel.'),
            'Channel for meme gallery posts.'
          )
        )
        .addSubcommand(subcommand =>
          addChannelOption(
            subcommand
              .setName('log-channel')
              .setDescription('Set the gallery moderation log channel.'),
            'Channel for gallery moderation logs.'
          )
        )
        .addSubcommand(subcommand =>
          addEnabledOption(
            subcommand
              .setName('enabled')
              .setDescription('Enable or disable gallery submissions.')
          )
        )
        .addSubcommand(subcommand =>
          addTagCategoryOption(
            subcommand
              .setName('add-tag')
              .setDescription('Add an approved gallery tag.')
              .addStringOption(option =>
                option
                  .setName('name')
                  .setDescription('Tag name, for example: UK Tanks.')
                  .setRequired(true)
                  .setMaxLength(60)
              )
          )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove-tag')
            .setDescription('Remove an approved gallery tag.')
            .addStringOption(option =>
              option
                .setName('name')
                .setDescription('Tag name to remove.')
                .setRequired(true)
                .setMaxLength(60)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('rewards')
        .setDescription('Configure automatic level reward roles.')
        .addSubcommand(subcommand =>
          addRoleOption(
            subcommand
              .setName('add-role')
              .setDescription('Add or update a level reward role.')
              .addIntegerOption(option =>
                option
                  .setName('level')
                  .setDescription('Required level for this role.')
                  .setRequired(true)
                  .setMinValue(1)
                  .setMaxValue(500)
              ),
            'Role to assign automatically.'
          )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove-role')
            .setDescription('Remove a level reward role from automation.')
            .addRoleOption(option =>
              option
                .setName('role')
                .setDescription('Role to remove from reward automation.')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('reason')
                .setDescription('Optional reason.')
                .setRequired(false)
                .setMaxLength(300)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List active level reward roles.')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('sync-user')
            .setDescription('Sync reward roles for a member now.')
            .addUserOption(option =>
              option
                .setName('user')
                .setDescription('Member to sync.')
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('tickets')
        .setDescription('Configure support tickets.')
        .addSubcommand(subcommand =>
          subcommand
            .setName('category')
            .setDescription('Set the category where ticket channels are created.')
            .addChannelOption(option =>
              option
                .setName('category')
                .setDescription('Ticket category.')
                .setRequired(true)
                .addChannelTypes(...categoryChannelTypes)
            )
        )
        .addSubcommand(subcommand =>
          addChannelOption(
            subcommand
              .setName('log-channel')
              .setDescription('Set the ticket log channel.'),
            'Channel for ticket logs.'
          )
        )
        .addSubcommand(subcommand =>
          addRoleOption(
            subcommand
              .setName('support-role')
              .setDescription('Set the support role for ticket access and pings.'),
            'Support role.'
          )
        )
        .addSubcommand(subcommand =>
          addEnabledOption(
            subcommand
              .setName('enabled')
              .setDescription('Enable or disable ticket creation.')
          )
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Config commands can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const message = await configCommandService.execute(interaction);
      await interaction.editReply(`Success: ${message}`);
    } catch (error) {
      await interaction.editReply(`Error: ${errorMessage(error)}`);
    }
  }
};
