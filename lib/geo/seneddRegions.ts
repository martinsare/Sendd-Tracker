/**
 * Official Welsh Senedd Electoral Boundaries Mapping
 * 
 * Maps Senedd Constituencies to their Electoral Regions.
 * Every voter in Wales is represented by 5 Members of the Senedd:
 * 1 Constituency MS + 4 Regional MSs.
 */

export const SENEDD_CONSTITUENCY_TO_REGION: Record<string, string> = {
  // South Wales Central
  "Cardiff Central": "South Wales Central",
  "Cardiff North": "South Wales Central",
  "Cardiff South and Penarth": "South Wales Central",
  "Cardiff West": "South Wales Central",
  "Cynon Valley": "South Wales Central",
  "Pontypridd": "South Wales Central",
  "Rhondda": "South Wales Central",
  "Vale of Glamorgan": "South Wales Central",
  "Caerdydd Canolog": "South Wales Central",
  "Gogledd Caerdydd": "South Wales Central",
  "De Caerdydd a Phenarth": "South Wales Central",
  "Gorllewin Caerdydd": "South Wales Central",
  "Cwm Cynon": "South Wales Central",
  "Bro Morgannwg": "South Wales Central",
  "Caerdydd Penarth": "South Wales Central",
  "Pontypridd Cynon Merthyr": "South Wales Central",

  // South Wales East
  "Blaenau Gwent": "South Wales East",
  "Caerphilly": "South Wales East",
  "Islwyn": "South Wales East",
  "Merthyr Tydfil and Rhymney": "South Wales East",
  "Monmouth": "South Wales East",
  "Newport East": "South Wales East",
  "Newport West": "South Wales East",
  "Torfaen": "South Wales East",
  "Dwyrain Casnewydd": "South Wales East",
  "Gorllewin Casnewydd": "South Wales East",
  "Mynwy": "South Wales East",
  "Merthyr Tudful a Rhymni": "South Wales East",
  "Blaenau Gwent and Rhymney": "South Wales East",

  // South Wales West
  "Aberavon": "South Wales West",
  "Bridgend": "South Wales West",
  "Gower": "South Wales West",
  "Neath": "South Wales West",
  "Ogmore": "South Wales West",
  "Swansea East": "South Wales West",
  "Swansea West": "South Wales West",
  "Pen-y-bont ar Ogwr": "South Wales West",
  "Gŵyr": "South Wales West",
  "Castell-nedd": "South Wales West",
  "Ogwr": "South Wales West",
  "Dwyrain Abertawe": "South Wales West",
  "Gorllewin Abertawe": "South Wales West",
  "Afan Ogwr Rhondda": "South Wales West",

  // Mid and West Wales
  "Brecon and Radnorshire": "Mid and West Wales",
  "Carmarthen East and Dinefwr": "Mid and West Wales",
  "Carmarthen West and South Pembrokeshire": "Mid and West Wales",
  "Ceredigion": "Mid and West Wales",
  "Dwyfor Meirionnydd": "Mid and West Wales",
  "Llanelli": "Mid and West Wales",
  "Montgomeryshire": "Mid and West Wales",
  "Preseli Pembrokeshire": "Mid and West Wales",
  "Aberhonddu a Maesyfed": "Mid and West Wales",
  "Dwyrain Caerfyrddin a Dinefwr": "Mid and West Wales",
  "Gorllewin Caerfyrddin a De Sir Benfro": "Mid and West Wales",
  "Sir Faldwyn": "Mid and West Wales",
  "Preseli Sir Benfro": "Mid and West Wales",
  "Ceredigion Preseli": "Mid and West Wales",

  // North Wales
  "Aberconwy": "North Wales",
  "Alyn and Deeside": "North Wales",
  "Arfon": "North Wales",
  "Clwyd South": "North Wales",
  "Clwyd West": "North Wales",
  "Delyn": "North Wales",
  "Vale of Clwyd": "North Wales",
  "Wrexham": "North Wales",
  "Ynys Môn": "North Wales",
  "Alun a Glannau Dyfrdwy": "North Wales",
  "De Clwyd": "North Wales",
  "Gorllewin Clwyd": "North Wales",
  "Dyffryn Clwyd": "North Wales",
  "Wrecsam": "North Wales",
  "Clwyd North": "North Wales",
  "Clwyd East": "North Wales",
};

/**
 * Returns the regional name given a constituency name.
 */
export function getRegionForConstituency(constituencyName: string): string | null {
  if (!constituencyName) return null;
  const norm = constituencyName.trim();
  if (SENEDD_CONSTITUENCY_TO_REGION[norm]) {
    return SENEDD_CONSTITUENCY_TO_REGION[norm];
  }

  const lower = norm.toLowerCase();
  for (const [key, reg] of Object.entries(SENEDD_CONSTITUENCY_TO_REGION)) {
    if (key.toLowerCase() === lower || lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return reg;
    }
  }

  return null;
}

