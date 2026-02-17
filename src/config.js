// config.js - Google Drive utilities, calculation methods, and default ayat/hadith data

// Google Drive API key (domain-restricted, safe to expose)
// Replace with your actual API key from Google Cloud Console
export const DRIVE_API_KEY = 'AIzaSyD1g0WI_N1leSgBp92xcZ546MWkOo1kElQ';

// Google Drive API v3 base URL
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * List files in a Google Drive folder (public, "Anyone with the link").
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Array<{id: string, name: string, mimeType: string}>>}
 */
export async function listDriveFolder(folderId) {
  const query = `'${folderId}' in parents and trashed = false`;
  const fields = 'files(id,name,mimeType)';
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&key=${DRIVE_API_KEY}&orderBy=name`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Drive API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.files || [];
}

/**
 * Get an image URL for a Drive file.
 * Uses the thumbnail endpoint which is designed for browser embedding.
 * @param {string} fileId - Google Drive file ID
 * @returns {string} Image URL
 */
export function getDriveImageUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
}

/**
 * Get a thumbnail URL for a Drive file (for smaller displays like QR codes).
 * @param {string} fileId - Google Drive file ID
 * @param {number} [maxWidth=800] - Maximum width in pixels
 * @returns {string} Thumbnail URL
 */
export function getDriveThumbnailUrl(fileId, maxWidth = 800) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${maxWidth}`;
}

/**
 * Discover Drive folder structure from a root folder.
 * Looks for: slideshow/ subfolder, qr-codes/ subfolder, background.* file
 * @param {string} rootFolderId - Root Google Drive folder ID
 * @returns {Promise<{slideshowFolderId: string|null, qrCodesFolderId: string|null, backgroundFileId: string|null}>}
 */
export async function discoverDriveFolders(rootFolderId) {
  const files = await listDriveFolder(rootFolderId);

  let slideshowFolderId = null;
  let qrCodesFolderId = null;
  let backgroundFileId = null;

  for (const file of files) {
    const nameLower = file.name.toLowerCase();
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      if (nameLower === 'slideshow') {
        slideshowFolderId = file.id;
      } else if (nameLower === 'qr-codes') {
        qrCodesFolderId = file.id;
      }
    } else if (nameLower.startsWith('background.') && file.mimeType.startsWith('image/')) {
      backgroundFileId = file.id;
    }
  }

  return { slideshowFolderId, qrCodesFolderId, backgroundFileId };
}

/**
 * Get slideshow image URLs from a Drive folder.
 * @param {string} folderId - Slideshow folder ID
 * @returns {Promise<Array<{id: string, name: string, url: string}>>}
 */
export async function getSlideshowImages(folderId) {
  const files = await listDriveFolder(folderId);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  return files
    .filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return imageExtensions.includes(ext) || file.mimeType.startsWith('image/');
    })
    .map(file => ({
      id: file.id,
      name: file.name,
      url: getDriveImageUrl(file.id),
    }));
}

/**
 * Get QR code images from a Drive folder.
 * Max 4, sorted alphabetically. Filename (minus extension) = label.
 * @param {string} folderId - QR codes folder ID
 * @returns {Promise<Array<{id: string, name: string, label: string, url: string}>>}
 */
export async function getQrCodeImages(folderId) {
  const files = await listDriveFolder(folderId);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  return files
    .filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return imageExtensions.includes(ext) || file.mimeType.startsWith('image/');
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 4)
    .map(file => {
      const label = file.name.replace(/\.[^.]+$/, '');
      return {
        id: file.id,
        name: file.name,
        label,
        url: getDriveImageUrl(file.id),
      };
    });
}

// Aladhan API calculation methods (name → method ID)
export const CALCULATION_METHODS = {
  'ISNA': 2,
  'MWL': 3,
  'Umm Al-Qura': 4,
  'Egyptian': 5,
  'Karachi': 1,
  'Tehran': 7,
  'Shia Ithna-Ashari': 0,
};

// Default Quranic Ayat/Hadith List - 40 Items
export const ayatHadithList = [
  // Prayer and Worship (1-8)
  { ar: 'إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ', en: 'Indeed, prayer prohibits immorality and wrongdoing. (Quran 29:45)' },
  { ar: 'وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ', en: 'I did not create the jinn and mankind except to worship Me. (Quran 51:56)' },
  { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', en: 'So remember Me; I will remember you. (Quran 2:152)' },
  { ar: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', en: 'And whoever puts his trust in Allah, then He will suffice him. (Quran 65:3)' },
  { ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', en: 'Indeed, Allah is with the patient. (Quran 2:153)' },
  { ar: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ', en: 'And never give up hope of Allah\'s mercy. (Quran 12:87)' },
  { ar: 'إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ', en: 'Indeed, Allah does not allow the reward of the doers of good to be lost. (Quran 9:120)' },
  { ar: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', en: 'And whoever fears Allah, He will make for him a way out. (Quran 65:2)' },

  // Community Values and Brotherhood (9-16)
  { ar: 'إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ', en: 'The believers are but brothers. (Quran 49:10)' },
  { ar: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', en: 'None of you truly believes until he loves for his brother what he loves for himself. (Bukhari & Muslim)' },
  { ar: 'خَيْرُكُمْ أَحْسَنُكُمْ أَخْلَاقًا', en: 'The best among you are those who have the best manners and character. (Bukhari)' },
  { ar: 'مَنْ لَا يَشْكُرِ النَّاسَ لَا يَشْكُرِ اللَّهَ', en: 'Whoever does not thank people has not thanked Allah. (Tirmidhi)' },
  { ar: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِندَ الْغَضَبِ', en: 'The strong man is not the one who can overpower others. The strong man is the one who controls himself when angry. (Bukhari)' },
  { ar: 'يَسِّرُوا وَلَا تُعَسِّرُوا', en: 'Make things easy and do not make them difficult. (Bukhari)' },
  { ar: 'وَلَا تَنَابَزُوا بِالْأَلْقَابِ', en: 'And do not insult one another with nicknames. (Quran 49:11)' },
  { ar: 'إِنَّ اللَّهَ يُحِبُّ الْمُحْسِنِينَ', en: 'Indeed, Allah loves the doers of good. (Quran 2:195)' },

  // Quran and Knowledge (17-24)
  { ar: 'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ', en: 'Read in the name of your Lord who created. (Quran 96:1)' },
  { ar: 'إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ', en: 'Indeed, this Quran guides to that which is most upright. (Quran 17:9)' },
  { ar: 'وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ', en: 'And We have certainly made the Quran easy for remembrance. (Quran 54:17)' },
  { ar: 'إِنَّ الَّذِينَ يَتْلُونَ كِتَابَ اللَّهِ وَأَقَامُوا الصَّلَاةَ', en: 'Indeed, those who recite the Book of Allah and establish prayer. (Quran 35:29)' },
  { ar: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ', en: 'Seeking knowledge is obligatory upon every Muslim. (Ibn Majah)' },
  { ar: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا', en: 'Whoever takes a path in search of knowledge. (Abu Dawud)' },
  { ar: 'إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ', en: 'Only those of His servants who have knowledge fear Allah. (Quran 35:28)' },
  { ar: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', en: 'And say: My Lord, increase me in knowledge. (Quran 20:114)' },

  // Sunnah and Following the Prophet (25-32)
  { ar: 'مَنْ أَحْيَا سُنَّتِي فَقَدْ أَحْيَانِي', en: 'Whoever revives my Sunnah has indeed revived me. (Tirmidhi)' },
  { ar: 'مَنْ رَغِبَ عَنْ سُنَّتِي فَلَيْسَ مِنِّي', en: 'Whoever turns away from my Sunnah is not from me. (Bukhari & Muslim)' },
  { ar: 'مَنْ أَطَاعَنِي فَقَدْ أَطَاعَ اللَّهَ', en: 'Whoever obeys me has obeyed Allah. (Bukhari & Muslim)' },
  { ar: 'مَنْ رَأَى مِنْكُمْ مُنْكَرًا فَلْيُغَيِّرْهُ', en: 'Whoever among you sees an evil, let him change it. (Muslim)' },
  { ar: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى أَكُونَ أَحَبَّ إِلَيْهِ', en: 'None of you truly believes until I am dearer to him than his father. (Bukhari)' },
  { ar: 'إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ', en: 'Indeed, Allah and His angels send blessings upon the Prophet. (Quran 33:56)' },
  { ar: 'قُلْ إِن كُنتُمْ تُحِبُّونَ اللَّهَ فَاتَّبِعُونِي', en: 'Say: If you love Allah, then follow me. (Quran 3:31)' },

  // Masajid and Community (33-36)
  { ar: 'وَمَنْ أَظْلَمُ مِمَّن مَّنَعَ مَسَاجِدَ اللَّهِ أَن يُذْكَرَ فِيهَا اسْمُهُ', en: 'And who is more unjust than one who prevents the mention of Allah\'s name in His mosques? (Quran 2:114)' },
  { ar: 'مَنْ بَنَى مَسْجِدًا لِلَّهِ بَنَى اللَّهُ لَهُ بَيْتًا فِي الْجَنَّةِ', en: 'Whoever builds a mosque for Allah, Allah will build for him a house in Paradise. (Bukhari & Muslim)' },
  { ar: 'إِنَّ الْمَسَاجِدَ لِلَّهِ فَلَا تَدْعُوا مَعَ اللَّهِ أَحَدًا', en: 'Indeed, the mosques are for Allah, so do not invoke anyone with Allah. (Quran 72:18)' },
  { ar: 'فِي بُيُوتٍ أَذِنَ اللَّهُ أَن تُرْفَعَ وَيُذْكَرَ فِيهَا اسْمُهُ', en: 'In houses which Allah has ordered to be raised and in which His name is mentioned. (Quran 24:36)' },

  // Day of Judgment and Accountability (37-40)
  { ar: 'يَوْمَ تَشْهَدُ عَلَيْهِمْ أَلْسِنَتُهُمْ وَأَيْدِيهِمْ وَأَرْجُلُهُم بِمَا كَانُوا يَعْمَلُونَ', en: 'On the Day when their tongues, hands and feet will bear witness against them as to what they used to do. (Quran 24:24)' },
  { ar: 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ * وَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ', en: 'So whoever does an atom\'s weight of good will see it. And whoever does an atom\'s weight of evil will see it. (Quran 99:7-8)' },
  { ar: 'يَوْمَ لَا تَمْلِكُ نَفْسٌ لِّنَفْسٍ شَيْئًا', en: 'On the Day when no soul will have power to do anything for another soul. (Quran 82:19)' },
  { ar: 'وَكُلُّ إِنسَانٍ أَلْزَمْنَاهُ طَائِرَهُ فِي عُنُقِهِ', en: 'And every person\'s fate We have fastened around his neck. (Quran 17:13)' },
];
