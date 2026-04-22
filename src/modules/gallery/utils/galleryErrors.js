class GalleryUserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GalleryUserError';
    this.isGalleryUserError = true;
  }
}

module.exports = {
  GalleryUserError
};
