// Data Module

const VALID_STATES = [
  'andaman and nicobar', 'andhra pradesh', 'arunachal pradesh', 'assam',
  'bihar', 'chandigarh', 'chhattisgarh', 'dadra and nagar haveli',
  'daman and diu', 'delhi', 'goa', 'gujarat', 'haryana', 'himachal pradesh',
  'jammu and kashmir', 'jharkhand', 'karnataka', 'kerala', 'ladakh',
  'lakshadweep', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya',
  'mizoram', 'nagaland', 'odisha', 'puducherry', 'punjab', 'rajasthan',
  'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh',
  'uttarakhand', 'west bengal', 'cbi'
];

const STATE_ALIASES = {
  'andaman & nicobar': 'andaman and nicobar',
  'andaman and nicobar islands': 'andaman and nicobar',
  'jammu & kashmir': 'jammu and kashmir',
  'j&k': 'jammu and kashmir',
  'nct of delhi': 'delhi',
  'orissa': 'odisha',
  'pondicherry': 'puducherry',
  'uttaranchal': 'uttarakhand'
};

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"'`\\]/g, '').replace(/\s+/g, ' ').trim().substring(0, 100);
}

function normalizeStateNameForDb(stateName) {
  const sanitized = sanitizeString(stateName).toLowerCase();
  return STATE_ALIASES[sanitized] || sanitized;
}

function isValidState(stateName) {
  const normalized = normalizeStateNameForDb(stateName);
  return VALID_STATES.includes(normalized);
}

function isValidCount(count) {
  const num = parseInt(count, 10);
  return !isNaN(num) && num >= 0 && num <= 999999 && Number.isInteger(num);
}

async function loadArrestData() {
  const db = getFirestore();
  if (!db) return { mapData: {}, rawData: {} };

  try {
    const snapshot = await db.collection('arrests').get();
    const rawData = {};
    const mapData = {};

    snapshot.forEach((doc) => {
      const docData = doc.data();
      // Use state field if available, otherwise use document ID
      const state = (docData.state || doc.id).toLowerCase();
      const arrests = typeof docData.count === 'number' ? docData.count : 0;
      const fir = typeof docData.firCount === 'number' ? docData.firCount : 0;

      if (arrests > 0 || fir > 0) {
        rawData[state] = { arrests, fir };

        // For map: combine CBI into Delhi
        const mapState = (state === 'cbi') ? 'delhi' : state;
        if (!mapData[mapState]) {
          mapData[mapState] = { arrests: 0, fir: 0 };
        }
        mapData[mapState].arrests += arrests;
        mapData[mapState].fir += fir;
      }
    });

    return { mapData, rawData };
  } catch (error) {
    throw new Error('Failed to load data');
  }
}

async function updateArrestCount(stateName, arrestCount, firCount, isAdditive = false) {
  if (!isValidState(stateName)) throw new Error('Invalid state name');
  if (!isValidCount(arrestCount)) throw new Error('Invalid arrest count');
  if (!isValidCount(firCount)) throw new Error('Invalid FIR count');

  const db = getFirestore();
  const auth = getAuth();

  if (!db || !auth) throw new Error('Service unavailable');
  if (!auth.currentUser) throw new Error('Authentication required');

  const normalizedState = normalizeStateNameForDb(stateName);
  let arrestNum = parseInt(arrestCount, 10);
  let firNum = parseInt(firCount, 10);

  try {
    const docRef = db.collection('arrests').doc(normalizedState);

    if (isAdditive) {
      const doc = await docRef.get();
      if (doc.exists) {
        const currentArrests = doc.data().count || 0;
        const currentFir = doc.data().firCount || 0;
        arrestNum = currentArrests + arrestNum;
        firNum = currentFir + firNum;
        if (arrestNum > 999999) throw new Error('Total arrest count exceeds maximum');
        if (firNum > 999999) throw new Error('Total FIR count exceeds maximum');
      }
    }

    await docRef.set({
      state: normalizedState,
      count: arrestNum,
      firCount: firNum,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser.email
    });
  } catch (error) {
    if (error.code === 'permission-denied') throw new Error('Permission denied');
    if (error.message && error.message.includes('exceeds')) throw error;
    throw new Error('Failed to update data');
  }
}

async function deleteArrestRecord(stateName) {
  if (!isValidState(stateName)) throw new Error('Invalid state name');

  const db = getFirestore();
  const auth = getAuth();

  if (!db || !auth) throw new Error('Service unavailable');
  if (!auth.currentUser) throw new Error('Authentication required');

  const normalizedState = normalizeStateNameForDb(stateName);

  try {
    await db.collection('arrests').doc(normalizedState).delete();
  } catch (error) {
    if (error.code === 'permission-denied') throw new Error('Permission denied');
    throw new Error('Failed to delete data');
  }
}

async function batchUpdateArrests(updates, isAdditive = false) {
  if (!Array.isArray(updates) || updates.length === 0) throw new Error('Invalid updates');
  if (updates.length > 50) throw new Error('Maximum 50 updates per batch');

  const db = getFirestore();
  const auth = getAuth();

  if (!db || !auth) throw new Error('Service unavailable');
  if (!auth.currentUser) throw new Error('Authentication required');

  for (const update of updates) {
    if (!isValidState(update.state)) throw new Error(`Invalid state: ${sanitizeString(update.state)}`);
    if (!isValidCount(update.arrests || 0)) throw new Error(`Invalid arrest count for ${sanitizeString(update.state)}`);
    if (!isValidCount(update.fir || 0)) throw new Error(`Invalid FIR count for ${sanitizeString(update.state)}`);
  }

  let currentData = {};
  if (isAdditive) {
    const loaded = await loadArrestData();
    currentData = loaded.rawData || {};
  }

  const batch = db.batch();
  const timestamp = firebase.firestore.FieldValue.serverTimestamp();
  const userEmail = auth.currentUser.email;

  for (const update of updates) {
    const normalizedState = normalizeStateNameForDb(update.state);
    const docRef = db.collection('arrests').doc(normalizedState);

    let finalArrests = parseInt(update.arrests || 0, 10);
    let finalFir = parseInt(update.fir || 0, 10);

    if (isAdditive && currentData[normalizedState]) {
      finalArrests += currentData[normalizedState].arrests || 0;
      finalFir += currentData[normalizedState].fir || 0;
      if (finalArrests > 999999) throw new Error(`Total arrests for ${normalizedState} exceeds maximum`);
      if (finalFir > 999999) throw new Error(`Total FIR for ${normalizedState} exceeds maximum`);
    }

    batch.set(docRef, {
      state: normalizedState,
      count: finalArrests,
      firCount: finalFir,
      updatedAt: timestamp,
      updatedBy: userEmail
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    if (error.code === 'permission-denied') throw new Error('Permission denied');
    throw new Error('Failed to update data');
  }
}

function getValidStatesList() {
  return [...VALID_STATES].sort();
}
