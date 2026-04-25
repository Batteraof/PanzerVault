const videoSubmitFlow = require('./flows/videoSubmitFlow');
const ticketCreateFlow = require('./flows/ticketCreateFlow');
const eventCreateFlow = require('./flows/eventCreateFlow');

const flows = [
  videoSubmitFlow,
  ticketCreateFlow,
  eventCreateFlow
];

async function handleInteraction(interaction) {
  if (!interaction.customId) return false;

  const flow = flows.find(candidate => candidate.owns(interaction.customId));
  if (!flow) return false;

  return flow.handle(interaction);
}

module.exports = {
  handleInteraction
};
