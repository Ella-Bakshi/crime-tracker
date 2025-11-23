async function loadMediaData() {
  const db = getFirestore();
  if (!db) return {};

  try {
    const snapshot = await db.collection('media').orderBy('createdAt', 'desc').get();
    const data = {};

    snapshot.forEach((doc) => {
      const docData = doc.data();
      if (docData.state && docData.link && docData.title) {
        const state = docData.state.toLowerCase();
        if (!data[state]) {
          data[state] = [];
        }
        data[state].push({
          id: doc.id,
          link: docData.link,
          title: docData.title,
          type: docData.type || 'article'
        });
      }
    });

    return data;
  } catch (error) {
    throw new Error('Failed to load media');
  }
}

/**
 * Add a new media item
 */
async function addMediaItem(stateName, link, title, type) {
  if (!stateName || !link || !title) {
    throw new Error('Missing required fields');
  }

  const db = getFirestore();
  const auth = getAuth();

  if (!db || !auth) throw new Error('Service unavailable');
  if (!auth.currentUser) throw new Error('Authentication required');

  // Sanitize inputs
  const sanitizedState = stateName.toLowerCase().trim();
  const sanitizedTitle = title.replace(/[<>]/g, '').trim().substring(0, 200);
  const sanitizedType = (type === 'video') ? 'video' : 'article';

  try {
    await db.collection('media').add({
      state: sanitizedState,
      link: link,
      title: sanitizedTitle,
      type: sanitizedType,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser.email
    });
  } catch (error) {
    if (error.code === 'permission-denied') throw new Error('Permission denied');
    throw new Error('Failed to add media');
  }
}

/**
 * Delete a media item
 */
async function deleteMediaItem(mediaId) {
  if (!mediaId) throw new Error('Invalid media ID');

  const db = getFirestore();
  const auth = getAuth();

  if (!db || !auth) throw new Error('Service unavailable');
  if (!auth.currentUser) throw new Error('Authentication required');

  try {
    await db.collection('media').doc(mediaId).delete();
  } catch (error) {
    if (error.code === 'permission-denied') throw new Error('Permission denied');
    throw new Error('Failed to delete media');
  }
}
