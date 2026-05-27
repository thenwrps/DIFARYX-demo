export interface XRDRefPeak {
  position: number; // 2-theta (degrees)
  relativeIntensity: number; // 0 to 100
  hkl?: string;
}

export interface SpectralFeatureRange {
  name: string;
  min: number;
  max: number;
  assignment: string;
  description: string;
}

export interface MaterialLibraryEntry {
  id: string;
  name: string;
  chemicalFormula: string;
  industry: 'Pharma' | 'Polymers' | 'Advanced Energy' | 'Minerals/Catalysts';
  xrdPeaks?: XRDRefPeak[];
  ftirBands?: SpectralFeatureRange[];
  ramanModes?: SpectralFeatureRange[];
}

export type UniversalMasterLibrary = MaterialLibraryEntry[];

export const UNIVERSAL_MASTER_LIBRARY: UniversalMasterLibrary = [
  // 1. Pharmaceuticals/APIs
  {
    id: 'paracetamol',
    name: 'Paracetamol Form I',
    chemicalFormula: 'C8H9NO2',
    industry: 'Pharma',
    xrdPeaks: [
      { position: 12.1, relativeIntensity: 45, hkl: '001' },
      { position: 15.5, relativeIntensity: 60, hkl: '110' },
      { position: 18.2, relativeIntensity: 80, hkl: '200' },
      { position: 23.5, relativeIntensity: 100, hkl: '121' },
      { position: 24.4, relativeIntensity: 75, hkl: '022' },
      { position: 26.5, relativeIntensity: 90, hkl: '220' },
      { position: 27.2, relativeIntensity: 55, hkl: '310' }
    ]
  },
  {
    id: 'aspirin',
    name: 'Aspirin',
    chemicalFormula: 'C9H8O4',
    industry: 'Pharma',
    ftirBands: [
      { name: 'O-H stretch', min: 2500, max: 3100, assignment: 'O-H stretching (carboxylic acid)', description: 'Broad absorption band of the carboxylic acid hydroxyl group.' },
      { name: 'C=O ester stretch', min: 1740, max: 1760, assignment: 'C=O stretching (ester)', description: 'Sharp carbonyl stretching peak characteristic of the ester group in acetylsalicylic acid.' },
      { name: 'C=O carboxyl stretch', min: 1675, max: 1695, assignment: 'C=O stretching (carboxylic acid)', description: 'Carbonyl stretching peak of the carboxylic acid group.' },
      { name: 'C=C aromatic stretch', min: 1595, max: 1615, assignment: 'C=C stretching (aromatic ring)', description: 'In-plane skeleton vibration of the aromatic benzene ring.' },
      { name: 'C-O stretch', min: 1170, max: 1200, assignment: 'C-O stretching (ester)', description: 'Ether-like carbon-oxygen single bond stretching.' }
    ]
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    chemicalFormula: 'C8H10N4O2',
    industry: 'Pharma',
    ramanModes: [
      { name: 'C-H stretch', min: 2900, max: 3000, assignment: 'C-H stretching', description: 'Vibrational modes of the methyl groups attached to the purine ring.' },
      { name: 'C=O stretch', min: 1680, max: 1710, assignment: 'C=O carbonyl stretching', description: 'Carbonyl vibrations of the amide groups.' },
      { name: 'Imidazole ring stretch', min: 1590, max: 1610, assignment: 'C=N / C=C stretching', description: 'Skeletal vibration mode of the imidazole component of the purine structure.' },
      { name: 'C-N stretch', min: 1315, max: 1345, assignment: 'C-N ring stretching', description: 'Intra-ring carbon-nitrogen single bond vibrations.' },
      { name: 'Ring bending', min: 545, max: 565, assignment: 'Purine ring bending', description: 'In-plane deformation and bending modes of the purine ring skeleton.' }
    ]
  },

  // 2. Polymers/Petrochemicals
  {
    id: 'pet',
    name: 'Polyethylene Terephthalate (PET)',
    chemicalFormula: '(C10H8O4)n',
    industry: 'Polymers',
    ftirBands: [
      { name: 'C=O stretch', min: 1710, max: 1730, assignment: 'C=O stretching (ester carbonyl)', description: 'Intense carbonyl stretching vibration signature of polyester.' },
      { name: 'C-O-C stretch', min: 1230, max: 1260, assignment: 'C-O stretching (ester linkage)', description: 'Asymmetric stretching of the C-O single bonds in ester groups.' },
      { name: 'C-O stretch (glycol)', min: 1080, max: 1110, assignment: 'C-O stretching (ethylene glycol residue)', description: 'Ether-like skeletal vibrations from the glycol chain unit.' },
      { name: 'Aromatic C-H bend', min: 720, max: 735, assignment: 'C-H out-of-plane bending (aromatic)', description: 'Out-of-plane bending vibration of the para-disubstituted benzene ring.' }
    ]
  },
  {
    id: 'nylon6',
    name: 'Nylon-6',
    chemicalFormula: '(C6H11NO)n',
    industry: 'Polymers',
    ramanModes: [
      { name: 'C-H stretch', min: 2900, max: 2950, assignment: 'C-H symmetric/asymmetric stretching', description: 'High-frequency vibration modes of the aliphatic methylene (-CH2-) units.' },
      { name: 'Amide I', min: 1625, max: 1645, assignment: 'C=O stretching (Amide I)', description: 'Carbonyl stretching vibration coupled with N-H plane bending in polyamide structure.' },
      { name: 'CH2 bend', min: 1430, max: 1450, assignment: 'CH2 deformation/bending', description: 'Scissoring vibration of the methylene group chain.' },
      { name: 'CH2 twist', min: 1280, max: 1315, assignment: 'CH2 twisting/wagging', description: 'Out-of-plane methylene deformation modes.' },
      { name: 'Amide III', min: 1245, max: 1270, assignment: 'C-N stretch / N-H bend (Amide III)', description: 'Mixed amide skeletal coupling vibrations.' }
    ]
  },
  {
    id: 'polystyrene',
    name: 'Polystyrene',
    chemicalFormula: '(C8H8)n',
    industry: 'Polymers',
    ramanModes: [
      { name: 'Aromatic C-H stretch', min: 3040, max: 3070, assignment: 'C-H stretching (aromatic)', description: 'High-frequency stretching of aromatic ring hydrogen bonds.' },
      { name: 'Aromatic C=C stretch', min: 1595, max: 1610, assignment: 'C=C ring stretching', description: 'In-plane skeletal double bond stretching of the phenyl ring.' },
      { name: 'C-H in-plane bend', min: 1020, max: 1040, assignment: 'C-H in-plane deformation', description: 'Phenyl ring C-H in-plane bending vibration.' },
      { name: 'Ring breathing', min: 995, max: 1010, assignment: 'Ring breathing mode', description: 'Highly active symmetric breathing vibration of the benzene ring.' }
    ]
  },
  {
    id: 'cellulose_cmc',
    name: 'Cellulose / CMC Matrix',
    chemicalFormula: 'C6H10O5 / [C6H7O2(OH)x(OCH2COONa)y]n',
    industry: 'Polymers',
    ftirBands: [
      { name: 'O-H stretch', min: 3250, max: 3500, assignment: 'O-H stretching (hydroxyls)', description: 'Broad absorption band of hydrogen-bonded hydroxyl groups on the polymer backbone.' },
      { name: 'C-H stretch', min: 2850, max: 2950, assignment: 'C-H stretching (aliphatic)', description: 'Methylene and methine C-H stretching vibrations.' },
      { name: 'COO- asymmetric stretch', min: 1585, max: 1625, assignment: 'COO- asymmetric stretching (carboxylate)', description: 'Strong carboxylate signature indicating carboxymethyl ether modifications.' },
      { name: 'COO- symmetric stretch', min: 1410, max: 1430, assignment: 'COO- symmetric stretching (carboxylate)', description: 'Symmetric vibration of the anionic carboxyl group.' },
      { name: 'C-O-C glycosidic stretch', min: 1020, max: 1070, assignment: 'C-O-C glycosidic linkage / skeletal stretch', description: 'Ether-like skeletal stretching of sugar ring backbones.' }
    ]
  },

  // 3. Advanced Energy/Semiconductors
  {
    id: 'mapbi3',
    name: 'Perovskite MAPbI3',
    chemicalFormula: 'CH3NH3PbI3',
    industry: 'Advanced Energy',
    xrdPeaks: [
      { position: 14.1, relativeIntensity: 100, hkl: '110' },
      { position: 20.0, relativeIntensity: 25, hkl: '112' },
      { position: 24.5, relativeIntensity: 35, hkl: '202' },
      { position: 28.4, relativeIntensity: 95, hkl: '220' },
      { position: 31.8, relativeIntensity: 45, hkl: '310' },
      { position: 40.6, relativeIntensity: 30, hkl: '224' },
      { position: 43.1, relativeIntensity: 50, hkl: '330' }
    ]
  },
  {
    id: 'licoo2',
    name: 'Lithium Cobalt Oxide (LiCoO2)',
    chemicalFormula: 'LiCoO2',
    industry: 'Advanced Energy',
    xrdPeaks: [
      { position: 18.9, relativeIntensity: 100, hkl: '003' },
      { position: 36.6, relativeIntensity: 40, hkl: '101' },
      { position: 38.3, relativeIntensity: 25, hkl: '006' },
      { position: 44.4, relativeIntensity: 85, hkl: '104' },
      { position: 48.5, relativeIntensity: 20, hkl: '015' },
      { position: 58.7, relativeIntensity: 30, hkl: '107' },
      { position: 64.3, relativeIntensity: 50, hkl: '110' }
    ]
  },
  {
    id: 'mxene_ti3c2',
    name: 'MXenes Ti3C2Tx',
    chemicalFormula: 'Ti3C2Tx',
    industry: 'Advanced Energy',
    ramanModes: [
      { name: 'Ti-O stretch', min: 190, max: 215, assignment: 'Ti-O / Ti-F stretching (A1g)', description: 'Out-of-plane symmetric stretching of termination oxygen or fluorine atoms relative to titanium.' },
      { name: 'Ti-C stretch', min: 370, max: 400, assignment: 'Ti-C stretching (Eg)', description: 'In-plane vibrational mode of the titanium-carbon core skeleton.' },
      { name: 'Ti-C-O mode', min: 600, max: 640, assignment: 'Ti-C-O / Ti-C-F coupling (A1g)', description: 'High-frequency breathing mode of the MXene sheet layers coupled with terminations.' }
    ]
  },

  // 4. Minerals/Catalysts
  {
    id: 'zsm5',
    name: 'Zeolite ZSM-5',
    chemicalFormula: 'Na3Al3Si93O192',
    industry: 'Minerals/Catalysts',
    ftirBands: [
      { name: 'Internal tetrahedral stretch', min: 1080, max: 1120, assignment: 'Internal Si-O-Si / Si-O-Al asymmetric stretch', description: 'Stretching vibration of the framework tetrahedral unit.' },
      { name: 'Double ring vibration', min: 540, max: 560, assignment: 'Double-five ring framework vibration', description: 'Characteristic structure-sensitive band confirming pentasil framework presence.' },
      { name: 'Symmetric stretch', min: 780, max: 805, assignment: 'Symmetric Si-O-Si stretching', description: 'External linkage symmetric stretching of the zeolite framework.' },
      { name: 'External asymmetric stretch', min: 1215, max: 1235, assignment: 'External asymmetric stretch', description: 'Framework structural vibration related to pentasil secondary building blocks.' }
    ]
  },
  {
    id: 'quartz_silica',
    name: 'Quartz Silica',
    chemicalFormula: 'SiO2',
    industry: 'Minerals/Catalysts',
    ramanModes: [
      { name: 'Si-O-Si symmetric stretch', min: 460, max: 470, assignment: 'Si-O-Si symmetric stretching (A1)', description: 'Primary Raman active band of quartz, indicating corner-sharing tetrahedral linkages.' },
      { name: 'Si-O-Si bend', min: 350, max: 360, assignment: 'Si-O-Si bending mode', description: 'Bending deformation vibration of tetrahedral rings.' },
      { name: 'Lattice mode', min: 200, max: 215, assignment: 'Tetrahedral rotation lattice mode', description: 'Translational or rotational lattice vibration of the silica network.' }
    ]
  },
  {
    id: 'spinel_ferrite',
    name: 'Spinel Ferrites (CoFe2O4)',
    chemicalFormula: 'CoFe2O4',
    industry: 'Minerals/Catalysts',
    ftirBands: [
      { name: 'Metal-Oxygen tetrahedral', min: 570, max: 610, assignment: 'Metal-Oxygen stretch (Tetrahedral site)', description: 'Vibrational signature of metal-oxygen stretching in tetrahedral coordination within the spinel lattice.' },
      { name: 'Metal-Oxygen octahedral', min: 380, max: 430, assignment: 'Metal-Oxygen stretch (Octahedral site)', description: 'Vibrational signature of metal-oxygen stretching in octahedral coordination within the spinel lattice.' }
    ],
    ramanModes: [
      { name: 'A1g spinel mode', min: 660, max: 700, assignment: 'A1g symmetric stretching', description: 'Symmetric stretching of metal-oxygen bonds in tetrahedral sublattices.' },
      { name: 'T2g spinel mode', min: 560, max: 595, assignment: 'T2g mode', description: 'Asymmetric stretching and bending of the spinel structure.' },
      { name: 'Ferrite shoulder', min: 930, max: 970, assignment: 'Substituted ferrite shoulder', description: 'Surface coordination or cationic vacancy defect mode in ferrite structures.' }
    ],
    xrdPeaks: [
      { position: 18.3, relativeIntensity: 15, hkl: '111' },
      { position: 30.1, relativeIntensity: 40, hkl: '220' },
      { position: 35.5, relativeIntensity: 100, hkl: '311' },
      { position: 43.1, relativeIntensity: 25, hkl: '400' },
      { position: 53.4, relativeIntensity: 12, hkl: '422' },
      { position: 57.0, relativeIntensity: 35, hkl: '511' },
      { position: 62.6, relativeIntensity: 45, hkl: '440' }
    ]
  }
];
