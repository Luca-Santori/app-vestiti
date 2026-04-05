/* ═══════════════════════════════════════════════════════
   ChromaMe — Costanti e Dati Stagioni
   ═══════════════════════════════════════════════════════ */

var CM = window.CM = window.CM || {};

CM.MAX_IMG_WIDTH = 800;
CM.FACE_SCORE_THRESHOLD = 0.4;
CM.TRYON_WIDTH = 600;
CM.TRYON_HEIGHT = 750;
CM.BG_REMOVAL_THRESHOLD = 40;
CM.SHARPENING_STRENGTH = 0.3;
CM.SAT_BOOST = 0.10;
CM.FACE_API_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

CM.STATE = {
  faceModelsLoaded: false,
  armoImage: null,
  faceImage: null,
  tryonPersonImage: null,
  tryonGarmentImage: null,
};

/**
 * Dati completi per le 12 stagioni cromatiche.
 * Ogni stagione include: palette (8 hex), avoid (6 hex), desc, tip, undertones, contrast.
 */
CM.SEASONS = {
  'Light Spring': {
    palette: ['#F7D488','#FFACAC','#A8D8B9','#87CEEB','#FFB347','#E6C3C3','#C9E4CA','#F0E68C'],
    avoid:   ['#000000','#2F2F2F','#4B0082','#800000','#1C1C1C','#3D0C02'],
    desc: 'Colori chiari, caldi e luminosi',
    tip: 'Scegli tonalità pastello calde come pesca, corallo chiaro e verde menta. Evita i neri puri e i colori troppo scuri che appesantiscono il tuo incarnato luminoso.',
    undertones: ['caldo'],
    contrast: 'basso'
  },
  'True Spring': {
    palette: ['#FF6F3C','#F4A261','#FFD166','#06D6A0','#FF8C42','#FFC857','#EF476F','#83C5BE'],
    avoid:   ['#000000','#4A0E4E','#1A1A2E','#800020','#2C003E','#3B0000'],
    desc: 'Colori vivaci, caldi e saturi',
    tip: 'I colori brillanti e caldi come arancione, giallo dorato e verde smeraldo esaltano la tua vitalità. Evita i toni spenti e i grigi freddi.',
    undertones: ['caldo'],
    contrast: 'medio'
  },
  'Warm Spring': {
    palette: ['#DAA520','#CD853F','#DEB887','#F4A460','#D2691E','#FFD700','#BC8F8F','#90EE90'],
    avoid:   ['#000000','#191970','#800080','#C0C0C0','#483D8B','#2F4F4F'],
    desc: 'Colori dorati, terrosi e avvolgenti',
    tip: 'Le tonalità dorate, caramello e terracotta sono i tuoi migliori alleati. Punta su tessuti naturali dai toni caldi per un look sofisticato.',
    undertones: ['caldo'],
    contrast: 'medio-basso'
  },
  'Light Summer': {
    palette: ['#B0C4DE','#D8BFD8','#C8A2C8','#ADD8E6','#E0B0FF','#AFEEEE','#DDA0DD','#F0F8FF'],
    avoid:   ['#FF4500','#FF6600','#FFD700','#8B4513','#FF8C00','#B8860B'],
    desc: 'Colori delicati, freddi e polverosi',
    tip: 'Le sfumature pastello fredde come lavanda, azzurro polvere e rosa cipria ti donano luminosità. Evita arancioni e marroni caldi.',
    undertones: ['freddo'],
    contrast: 'basso'
  },
  'True Summer': {
    palette: ['#6B8E9B','#8E8E9B','#87CEEB','#B0ACCA','#9BAFAD','#CDB5CD','#76A5AF','#A094AA'],
    avoid:   ['#FF4500','#FF8C00','#B8860B','#8B4513','#DAA520','#FF6347'],
    desc: 'Colori medi, freddi e sfumati',
    tip: 'I toni soft come blu grigiastro, malva e verde salvia bilanciano il tuo incarnato. Evita i colori troppo accesi e le tonalità calde.',
    undertones: ['freddo'],
    contrast: 'medio-basso'
  },
  'Soft Summer': {
    palette: ['#8FBC8F','#778899','#B0A99F','#9E9E87','#A9A9A9','#C4AEAD','#8B8989','#B2BEB5'],
    avoid:   ['#FF0000','#FF6600','#FFD700','#00FF00','#FF1493','#FF4500'],
    desc: 'Colori smorzati, neutro-freddi e sofisticati',
    tip: 'I colori polverosi e desaturati come grigio-verde, tortora e rosa antico creano armonia. Evita neon, arancioni vivi e gialli brillanti.',
    undertones: ['neutro-freddo'],
    contrast: 'medio-basso'
  },
  'Soft Autumn': {
    palette: ['#C4A882','#A0785A','#8B7B6B','#9CAF88','#C2B280','#D2B48C','#BDB76B','#A89070'],
    avoid:   ['#FF00FF','#0000FF','#FF1493','#00FFFF','#9400D3','#FF69B4'],
    desc: 'Colori terrosi, morbidi e naturali',
    tip: 'Abbraccia le tonalità della terra: beige dorato, verde oliva e cammello. I tessuti con texture naturale come lino e cashmere sono il tuo punto di forza.',
    undertones: ['neutro-caldo'],
    contrast: 'medio-basso'
  },
  'True Autumn': {
    palette: ['#B7410E','#CC7722','#8B6914','#556B2F','#8B4513','#CD853F','#A0522D','#6B8E23'],
    avoid:   ['#FF00FF','#0000FF','#C0C0C0','#FF1493','#E6E6FA','#4169E1'],
    desc: 'Colori ricchi, caldi e intensi',
    tip: 'I rossi mattone, i marroni cioccolato e i verdi bosco sono la tua palette ideale. I look layered in toni autunnali valorizzano la tua naturale ricchezza cromatica.',
    undertones: ['caldo'],
    contrast: 'medio-alto'
  },
  'Dark Autumn': {
    palette: ['#8B0000','#4A2511','#556B2F','#8B4513','#654321','#704214','#8B6914','#3B3C36'],
    avoid:   ['#FF69B4','#00FFFF','#FF00FF','#87CEEB','#FFB6C1','#E0FFFF'],
    desc: 'Colori profondi, caldi e avvolgenti',
    tip: 'Le tonalità scure e calde come bordeaux, cioccolato fondente e verde foresta sono il tuo territorio. Un tocco di bronzo o rame negli accessori completa il look.',
    undertones: ['caldo'],
    contrast: 'alto'
  },
  'Dark Winter': {
    palette: ['#191970','#800020','#006400','#4B0082','#2F2F2F','#8B008B','#3D0C02','#1C2951'],
    avoid:   ['#FFD700','#FF8C00','#FFDAB9','#F5DEB3','#FAEBD7','#F0E68C'],
    desc: 'Colori scuri, freddi e drammatici',
    tip: 'I colori profondi e freddi come blu notte, borgogna e smeraldo scuro creano impatto. Abbina con bianco ottico o argento per un contrasto elegante.',
    undertones: ['freddo'],
    contrast: 'alto'
  },
  'True Winter': {
    palette: ['#0000CD','#DC143C','#006400','#FF0000','#000080','#4169E1','#FF1493','#00CED1'],
    avoid:   ['#F5DEB3','#DEB887','#D2B48C','#FFD700','#FFDAB9','#FAEBD7'],
    desc: 'Colori puri, freddi e ad alto contrasto',
    tip: 'I colori vividi e saturi come rosso puro, blu cobalto e bianco neve sono perfetti. Il contrasto netto è la tua arma segreta nello stile.',
    undertones: ['freddo'],
    contrast: 'alto'
  },
  'Bright Winter': {
    palette: ['#FF1493','#00BFFF','#FF4500','#00FF7F','#FF00FF','#1E90FF','#FFD700','#00CED1'],
    avoid:   ['#D2B48C','#8B8378','#A9A9A9','#808080','#696969','#DCDCDC'],
    desc: 'Colori elettrici, freddissimi e vibranti',
    tip: 'I colori ad alta energia come fucsia, turchese e viola elettrico fanno risplendere la tua carnagione. Non aver paura di osare: i contrasti cromatici forti ti appartengono.',
    undertones: ['freddo'],
    contrast: 'alto'
  }
};
