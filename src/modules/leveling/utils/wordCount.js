function countWords(content) {
  if (!content || typeof content !== 'string') return 0;

  const matches = content
    .trim()
    .match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu);

  return matches ? matches.length : 0;
}

function textXpForWordCount(wordCount) {
  if (wordCount <= 0) return 0;
  if (wordCount <= 3) return 1;
  if (wordCount <= 5) return 3;
  if (wordCount <= 15) return 8;
  return 12;
}

function textXpForMessage(content) {
  return textXpForWordCount(countWords(content));
}

module.exports = {
  countWords,
  textXpForWordCount,
  textXpForMessage
};
