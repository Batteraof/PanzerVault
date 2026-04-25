const TAG_GROUPS = {
  tank_type: {
    label: 'Tank Type',
    placeholder: 'Tank type',
    options: [
      ['light', 'Light'],
      ['medium', 'Medium'],
      ['heavy', 'Heavy'],
      ['tank_destroyer', 'Tank Destroyer'],
      ['spg', 'SPG'],
      ['other', 'Other']
    ]
  },
  map: {
    label: 'Map',
    placeholder: 'Map',
    options: [
      ['urban', 'Urban'],
      ['open_field', 'Open Field'],
      ['forest', 'Forest'],
      ['desert', 'Desert'],
      ['snow', 'Snow'],
      ['mixed', 'Mixed']
    ]
  },
  mode: {
    label: 'Mode',
    placeholder: 'Mode',
    options: [
      ['casual', 'Casual'],
      ['competitive', 'Competitive'],
      ['training', 'Training'],
      ['event', 'Event'],
      ['custom', 'Custom']
    ]
  },
  content_type: {
    label: 'Content Type',
    placeholder: 'Content type',
    options: [
      ['clip', 'Clip'],
      ['full_match', 'Full Match'],
      ['guide', 'Guide'],
      ['meme', 'Meme'],
      ['screenshot', 'Screenshot'],
      ['highlight', 'Highlight']
    ]
  }
};

function getTagGroups() {
  return TAG_GROUPS;
}

function optionToSelectOption([value, label], selectedValue) {
  return {
    label,
    value,
    default: value === selectedValue
  };
}

function getSelectOptions(tagType, selectedValue = null) {
  const group = TAG_GROUPS[tagType];
  if (!group) return [];
  return group.options.map(option => optionToSelectOption(option, selectedValue));
}

function normalizeTags(input = {}) {
  const tags = {};

  for (const [tagType, group] of Object.entries(TAG_GROUPS)) {
    const value = input[tagType];
    if (!value) continue;

    const allowed = new Set(group.options.map(option => option[0]));
    if (allowed.has(value)) {
      tags[tagType] = value;
    }
  }

  return tags;
}

function tagsToText(tags = {}) {
  const labels = [];

  for (const [tagType, value] of Object.entries(tags)) {
    const group = TAG_GROUPS[tagType];
    if (!group) continue;
    const option = group.options.find(([optionValue]) => optionValue === value);
    if (option) labels.push(`${group.label}: ${option[1]}`);
  }

  return labels.length ? labels.join('\n') : 'No tags selected';
}

module.exports = {
  getTagGroups,
  getSelectOptions,
  normalizeTags,
  tagsToText
};
