/** Representative south-polar Artemis candidate landing sites from Wüller et al. (2025). */
export const LUNAR_REFERENCE_SITES = [
  { id: "PCB01", name: "Peak near Cabeus B", latitude: -83.763, longitude: -69.983 },
  { id: "HW01", name: "Haworth", latitude: -86.768, longitude: -20.514 },
  { id: "MMA01", name: "Malapert Massif", latitude: -85.942, longitude: -0.944 },
  { id: "MMP01", name: "Mons Mouton Plateau", latitude: -85.111, longitude: 26.710 },
  { id: "MMO01", name: "Mons Mouton", latitude: -85.416, longitude: 31.851 },
  { id: "NR101", name: "Nobile Rim 1", latitude: -85.295, longitude: 36.917 },
  { id: "NR201", name: "Nobile Rim 2", latitude: -84.054, longitude: 56.481 },
  { id: "dGR201", name: "de Gerlache Rim 2", latitude: -88.389, longitude: -68.865 },
  { id: "SP01", name: "Slater Plain", latitude: -87.478, longitude: 124.521 },
] as const;

export const NASA_ARTEMIS_REGIONS_URL = "https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/";
export const SITE_COORDINATES_SOURCE_URL = "https://doi.org/10.1029/2025JE009434";
