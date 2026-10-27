/**
 * Gautam Buddha University (GBU) Official Course Catalogue.
 * Complete curriculum subjects across all university schools and semesters.
 */

export interface CatalogueSubject {
  code: string;
  name: string;
  school: string;
  dept: string;
  progs: string[];
  sems: string[];
}

export const UNIVERSITY_SUBJECT_CATALOGUE: CatalogueSubject[] = [
  {
    "code": "AI301",
    "name": "Big Data Analytics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI303",
    "name": "Compiler Design",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI305",
    "name": "Deep Learning and Reinforcement Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI307",
    "name": "Operational Information Security Management & Biometrics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI309",
    "name": "Computer Graphics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI329",
    "name": "Elective 2: Data Mining",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI381",
    "name": "Big Data Analytics Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI383",
    "name": "Compiler Design Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI385",
    "name": "Deep Learning Lab using Python",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "AI401",
    "name": "Parallel Processing and CUDA Programming",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "AI403",
    "name": "Computational Intelligence",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "AI405",
    "name": "Robotics and Drones",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "AI407",
    "name": "Natural Language Processing",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "AI411",
    "name": "Blockchain Technology using SALONA",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "AI481",
    "name": "Robotics and Drones Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "AS601",
    "name": "Research Methodology",
    "school": "SOBT",
    "dept": "MA",
    "progs": [
      "PhDBT"
    ],
    "sems": [
      ""
    ]
  },
  {
    "code": "BCA101",
    "name": "Computer  Fundamentals and Programming",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BCA103",
    "name": "Artificial Intelligence",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BCA105",
    "name": "Digital Electronics",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BCA181",
    "name": "C Programming Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BCA201",
    "name": "Operating System",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BCA203",
    "name": "Fundamental of Python Programming",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BCA205",
    "name": "Object Oriented Programming Using C++",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BCA207",
    "name": "M Commerce",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA",
      "BHM",
      "UHS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BCA281",
    "name": "Operating System Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BCA283",
    "name": "Fundamental of Python Programming Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BCA285",
    "name": "Object Oriented Programming Using C++ Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BCA301",
    "name": "PHP",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BCA303",
    "name": "Introduction to Compiler Design",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BCA305",
    "name": "Basics of Computer Graphics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BCA307",
    "name": "Computer Networks Fundamentals",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BCA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BCA315",
    "name": "Fundamentals of Cyber Security",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BCA319",
    "name": "Introduction to Multimedia System",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BCA381",
    "name": "PHP Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA",
      "UMC"
    ],
    "sems": [
      "II",
      "III"
    ]
  },
  {
    "code": "BCA383",
    "name": "Compiler Design Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BCA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BCO103",
    "name": "Management Principles and Applications",
    "school": "SOM",
    "dept": "MB",
    "progs": [
      "BCOM"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BCO107",
    "name": "Business Law",
    "school": "SOM",
    "dept": "NA",
    "progs": [
      "BCOM"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BCO112",
    "name": "Personal Financial Planning",
    "school": "SOICT",
    "dept": "MB",
    "progs": [
      "CSE-DS",
      "CSE-Cyber",
      "ICS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES101",
    "name": "Fundamentals of Environmental Biology",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BES103",
    "name": "Applied Mathematics for Environment",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BES105",
    "name": "Earth and Earth Surface Processes",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BES107",
    "name": "Environmental Pollution",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BES109",
    "name": "Global Environmental Change",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BES111",
    "name": "Science Communication and Public Outreach",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BES113",
    "name": "Environmental Monitoring Laboratory I and Field Study",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BES201",
    "name": "Global Environmental Health",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES203",
    "name": "Earth System Science in Anthropocene",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES205",
    "name": "Natural Resource Management",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES207",
    "name": "Environmental Law and Governance",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES209",
    "name": "Indian Knowledge System for Sustainable Practices",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES211",
    "name": "Geospatial Analysis for Environmental Problem Solving",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES213",
    "name": "Research Ethics and Methods",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES215",
    "name": "Computational Analytics for Environment",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES217",
    "name": "Environmental Modelling Lab II and Field Study",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BES301",
    "name": "Water and Wastewater Treatment",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES303",
    "name": "Sustainable Agriculture and Agroforestry",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES305",
    "name": "Natural Hazards and Disaster Risk Reduction",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES307",
    "name": "Climate Science and Solutions",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES309",
    "name": "Green Economy: Principle and Practice",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES311",
    "name": "ESG and Carbon Market",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES313",
    "name": "Intellectual Property Rights (IPR)",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES315",
    "name": "Environmental Monitoring Laboratory III and Field Study",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BES317",
    "name": "Seminar",
    "school": "SOVSAS",
    "dept": "BT",
    "progs": [
      "UES"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BHE201",
    "name": "Intermediate Microeconomics",
    "school": "SOVSAS",
    "dept": "EP",
    "progs": [
      "UHS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHM109",
    "name": "Calculus",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UHS",
      "BHM"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BHM113",
    "name": "Introduction to Programming",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BHM115",
    "name": "Descriptive Statistics",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UHS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BHM117",
    "name": "Programming Lab",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BHM209",
    "name": "Group Theory",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHM211",
    "name": "Probability Theory",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHM215",
    "name": "Partial Differential Equations",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM",
      "UHS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHM217",
    "name": "Partial differential equations lab",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM",
      "UHS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHM301",
    "name": "Numerical Methods",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BHM305",
    "name": "Number Theory",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BHM309",
    "name": "Linear Programming with Applications-II",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BHM311",
    "name": "Graph Theory",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BHM315",
    "name": "Numerical Analysis Lab",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BHM325",
    "name": "Riemann Integral and series of functions",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BHMI101",
    "name": "Basic Algebra",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BHMI201",
    "name": "Basic Geometry",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHMS101",
    "name": "Web Designing and LATEX",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM",
      "UHS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BHMS207",
    "name": "Scientific Computation with Matlab",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UHS",
      "BHM"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHMV104",
    "name": "MS Word and Excel",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM",
      "UHS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BHS201",
    "name": "Sampling Distributions and Statistical Inference",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UHS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT101",
    "name": "Problem Solving Using C",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BIT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BIT183",
    "name": "Problem Solving Using C Lab",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BIT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BIT201",
    "name": "Web Technology",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT203",
    "name": "Data Structure",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT205",
    "name": "Database Management System",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT207",
    "name": "Computer Organization and Archirtecture",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT209",
    "name": "Artificial Intelligence",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT281",
    "name": "Web Technology Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT283",
    "name": "Data Structure Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BIT285",
    "name": "Database Managament System Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BS101",
    "name": "Human Vaues & Buddhist Ethics",
    "school": "SOE",
    "dept": "BS",
    "progs": [
      "BEE",
      "BT",
      "UBT",
      "IBTAB",
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BT101",
    "name": "Life Sciences",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "BT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BT103",
    "name": "Introduction to Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BT105",
    "name": "Basic Biotechnology Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BT201",
    "name": "Cell Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BT203",
    "name": "Fundamental of Biochemistry",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BT205",
    "name": "Fundamentals of Microbiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BT207",
    "name": "Introductory Bioinformatics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BT211",
    "name": "Ecology and Environment",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BT213",
    "name": "Lab I: CellBiol, Microbiol. and Biochemistry",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BT215",
    "name": "Lab II: Basic Bioinformatics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BT301",
    "name": "Molecular Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT303",
    "name": "Biophysical Chemistry",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT305",
    "name": "Developmental Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT307",
    "name": "Food Biotechnology",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT309",
    "name": "Environmental Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT311",
    "name": "Developments on Therapeutics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT315",
    "name": "Lab I: Molecular Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT317",
    "name": "Lab II: Environmental Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BT507",
    "name": "Microbiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT509",
    "name": "Plant and Animal Cell Culture Technolgy",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT517",
    "name": "Principles of Bioreaction ENgineering",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT519",
    "name": "nanobiotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT521",
    "name": "Molecular Medicine",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT525",
    "name": "Molecular Toxicology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT527",
    "name": "Lab I: Cell Culture Technology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT529",
    "name": "Lab II: Microbial Technology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT531",
    "name": "Lab III Bioprocess Technology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BT601",
    "name": "Bioprocess Equipments Design and Economics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT603",
    "name": "Bioenterpreneurship",
    "school": "SOBT",
    "dept": "MB",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT605",
    "name": "Instrumentation and Control",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT607",
    "name": "Research Methodology and Scientific Communication",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT609",
    "name": "IPR, Biosafety and Bioethics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT611",
    "name": "Project Proposal Preparationa nd Presentation",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT613",
    "name": "Lab I: Downstream Processing in Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT625",
    "name": "Protein Engineering",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT627",
    "name": "Systems and Synthetic Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "BT"
    ],
    "sems": [
      "V"
    ]
  },
  {
    "code": "BT802",
    "name": "Adv in Research Techniques",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "PhDBT"
    ],
    "sems": [
      ""
    ]
  },
  {
    "code": "BT807",
    "name": "Bioniformatics tools for research",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "PhDBT"
    ],
    "sems": [
      ""
    ]
  },
  {
    "code": "BTAYB101",
    "name": "Fundamentals of Sanskrit-I",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB103",
    "name": "Introduction to Ayurveda",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB105",
    "name": "History of Ayurveda",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB107",
    "name": "Introductory Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB109",
    "name": "Introductory Chemistry Lab",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB111",
    "name": "Application of  IT and E-resources in Ayurveda",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB113",
    "name": "Application of  IT and E-resources in Ayurveda Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB115",
    "name": "Introductory Chemistry",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTAYB201",
    "name": "Adv. Sanskrit-I",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTAYB203",
    "name": "Human Anatomy and Sarira Rachana Vigyan",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTAYB205",
    "name": "Human Physiology and Ayurvedic Kriya Sarir",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTAYB207",
    "name": "Principle and Practices of Ashtang hardaya",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTAYB209",
    "name": "Genetics and Molecular Biology for Ayurveda",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTAYB211",
    "name": "Ayurveda Lab-I",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTAYB213",
    "name": "Medical Microbiology for Ayurveda",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "IBTAB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS101",
    "name": "Physics",
    "school": "SOBT",
    "dept": "PH",
    "progs": [
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBFS103",
    "name": "Crime and Society",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBFS105",
    "name": "Forensic Anthropology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBFS107",
    "name": "Introduction to Forensic Science",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBFS109",
    "name": "Basic Forensic Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBFS201",
    "name": "Biology I: Zoology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS203",
    "name": "Instrumentation-I",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS205",
    "name": "Forensic Dermatoglyphics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS207",
    "name": "Scene of Crime Management",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS209",
    "name": "Forensic Dermatoglyphics Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS211",
    "name": "Crime Scene Investigation Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS213",
    "name": "Bioinformatics: Introduction and applications",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS215",
    "name": "Basics of Molecular Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS217",
    "name": "Food Forensics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBFS301",
    "name": "Biology I : Botany",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS303",
    "name": "Digital Forensics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS305",
    "name": "Forensic Physics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS307",
    "name": "Ballistics and Explosives",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS309",
    "name": "Digital Forensic Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS311",
    "name": "Forensic Physics Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS315",
    "name": "Forensic Engineering",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS317",
    "name": "Artificial Intelligence",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBFS321",
    "name": "Waste Management",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "UFS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC101",
    "name": "Plant physilogy",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBSC103",
    "name": "Animal Physiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBSC105",
    "name": "Fundamentals of Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBSC107",
    "name": "Animal and Plant Physiology Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTBSC201",
    "name": "Biochemistry-I",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC203",
    "name": "Molecular Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC205",
    "name": "Biochemistry Lab",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC207",
    "name": "Molecular Biology Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC209",
    "name": "Basics of Forensic Science",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC211",
    "name": "Food Microbiology",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC213",
    "name": "Introductory Bioinformatics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC215",
    "name": "Industrial Microbiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTBSC301",
    "name": "Bioprocess Technology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC303",
    "name": "Basics of Immunology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC305",
    "name": "Animal Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC307",
    "name": "Bioanalytical Techniques-II",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC309",
    "name": "Animal Biotechnology Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC311",
    "name": "Bioprocess Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC313",
    "name": "Cancer Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC315",
    "name": "Developmental Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC317",
    "name": "Pharmeceutical Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC319",
    "name": "Nanobiotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "BTBSC403",
    "name": "Innovation & Entrepreneurship",
    "school": "SOBT",
    "dept": "MB",
    "progs": [
      "UBT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BTBSC405",
    "name": "Biostatistics",
    "school": "SOBT",
    "dept": "MA",
    "progs": [
      "UBT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BTBSC407",
    "name": "IPR, Bisafety & Bioethics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "BTCH101",
    "name": "Chemistry-I",
    "school": "SOBT",
    "dept": "CH",
    "progs": [
      "UBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTCH201",
    "name": "Chemistr-II",
    "school": "SOBT",
    "dept": "CH",
    "progs": [
      "UBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTIT101",
    "name": "IT and Its applications-I Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "UBT",
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMA445",
    "name": "Basics of Mathematics and Biostatistics",
    "school": "SOBT",
    "dept": "MA",
    "progs": [
      "MSLS",
      "MBTR",
      "MBT",
      "MSMB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc501",
    "name": "Biochemistry",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "MSMB",
      "MBT",
      "MSLS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc503",
    "name": "Cell and Molecular Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS",
      "MBT",
      "MSMB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc505",
    "name": "Plant and Animal Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT",
      "MSLS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc507",
    "name": "Microbiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB",
      "MSLS",
      "MBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc509",
    "name": "Genetics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS",
      "MBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc511",
    "name": "Basics of Chemistry and Physics",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "MBT",
      "MSLS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc513",
    "name": "Biochemistry and Analytical Techniques",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT",
      "MSMB",
      "MSLS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc515",
    "name": "Microbiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB",
      "MSLS",
      "MBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMsc517",
    "name": "Plant and Animal Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT",
      "MSLS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BtMSc531",
    "name": "Bioinformatics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BtMSC533",
    "name": "Nanobiotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BtMSc535",
    "name": "Microbial Genetics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BtMSc537",
    "name": "Bioinformatics lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BtMSC601",
    "name": "Bioprocess Engg & Tech.",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC603",
    "name": "Emerging Technologies",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC605",
    "name": "Critical Analysis of Classical Papers",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC607",
    "name": "Bioenterpreneurship",
    "school": "SOBT",
    "dept": "MB",
    "progs": [
      "MBT",
      "MSMB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC609",
    "name": "Intellectual Property Rights, Biosafty and Bioethics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT",
      "MSMB",
      "MSLS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC611",
    "name": "Project Proposal Preparation and Presentation",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC613",
    "name": "Seminar",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB",
      "MBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC615",
    "name": "Laboratory I: Bioprocess Engineering and Technology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSC617",
    "name": "Laboratory II: Bioinformatics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSc635",
    "name": "Computational Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSc637",
    "name": "Biomedical Genomics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSc639",
    "name": "Agriculture Genomics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMSc6411",
    "name": "Computational Programming through Python and R lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMsc643",
    "name": "Microbial Pathogenesis and Diagnosis",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMSC645",
    "name": "Vaccine research & Development",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMSC647",
    "name": "Research methodology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMSC649",
    "name": "System & synthetic biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS",
      "MSMB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMSC651",
    "name": "Computational Biology and Genomics Lab",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSLS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMSC655",
    "name": "Advanced microbial techniques",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MSMB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMSR101",
    "name": "Genetic Engineering & Immunology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBTR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMSR103",
    "name": "Bioprocess Technology & Downsstream Processing",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBTR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMSR105",
    "name": "Molecular and Cellular Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBTR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMSR115",
    "name": "Protein Engineering",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBTR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMSR119",
    "name": "Cancer Biology and Drug Discovery",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBTR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMSR127",
    "name": "Laboratory I: Bioprocess and Downstream Processing",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MBTR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT501",
    "name": "Biochemistry",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT503",
    "name": "Cell & Mol. Biol.",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT505",
    "name": "Introduction to Engineering Principles",
    "school": "SOBT",
    "dept": "EE",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT507",
    "name": "Microbiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT509",
    "name": "Plant and Animal Cell Culture Technology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT511",
    "name": "Basics of Chemistry and Physics",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT513",
    "name": "Laboratory I: Biochemistry and Analytical Techniques",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BTMT515",
    "name": "Laboratory II: Microbiology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "BtMT601",
    "name": "Bioprocess Equipment Design and Economics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMT603",
    "name": "Bioenterpreneurship",
    "school": "SOBT",
    "dept": "MB",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMT605",
    "name": "Instrumentation and Control",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMT607",
    "name": "Res. Method. and Scientific Communication Skills",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMT609",
    "name": "Intellectual Property Rights, Biosafty and Bioethics",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMT611",
    "name": "Project Proposal Preparation and Presentation",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BtMT613",
    "name": "Laboratory I: Downstream Processing in Biotechnology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMT625",
    "name": "Protein Engineering",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTMT627",
    "name": "Systems and Synthetic Biology",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "MTB"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "BTVAC101",
    "name": "Social & Emotional well being",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "UBT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CA623",
    "name": "Generative AI",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CA635",
    "name": "Agentic AI",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CA639",
    "name": "Introduction to Large Language Models",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CA681",
    "name": "Generative AI Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI101",
    "name": "Problem Solving Using C",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CAI181",
    "name": "Problem Solving Using C Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CAI201",
    "name": "Scientific Computing with Python",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI203",
    "name": "Data Structures",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI205",
    "name": "Machine Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI207",
    "name": "Computer Networks",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI209",
    "name": "Operating System",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI281",
    "name": "Scientific Computing with Python Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI283",
    "name": "Data Structures Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI285",
    "name": "Computer Networks Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CAI287",
    "name": "Machine Learning Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CC301",
    "name": "Compiler Design",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC303",
    "name": "Soft Computing Techniques",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC305",
    "name": "Analysis and design of algorithms",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC307",
    "name": "Cryptography & Data Privacy",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC309",
    "name": "Machine Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC319",
    "name": "Ethical Hacking",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC381",
    "name": "Analysis& Design of Algorithms Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC383",
    "name": "Cryptography & Data Privacy Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC385",
    "name": "Machine Learning Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CC401",
    "name": "Parallel Processing and CUDA Programming",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CC403",
    "name": "Blockchain Technology",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CC405",
    "name": "AI Enabled Cyber Secuirty",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CC411",
    "name": "Operating Systems Security",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CC425",
    "name": "Access Control and Identity Management",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CC481",
    "name": "AI Enabled Cyber Secuirty Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CD301",
    "name": "Compiler Design",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD303",
    "name": "Soft Computing Techniques",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD305",
    "name": "Analysis and design of algorithms",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD307",
    "name": "BIg Data Analytics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD309",
    "name": "Machine Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD315",
    "name": "Data Science Life Cycle",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD381",
    "name": "Analysis& Design of Algorithms Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD383",
    "name": "Big Data Analytics Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD385",
    "name": "Machine Learning Lab using Python",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CD401",
    "name": "Parallel Processing and CUDA Programming",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CD403",
    "name": "Cryptography and Network Security",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CD405",
    "name": "Data Analytics using R",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CD407",
    "name": "Business Intelligence",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CD425",
    "name": "Social Media Analytics and Techniques",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CD481",
    "name": "Data Analytics using R Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CD623",
    "name": "Big Data Analytics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MDS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CD635",
    "name": "Agentic AI",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MDS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CD649",
    "name": "Data Security",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MDS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CD681",
    "name": "Big Data and Analytics Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MDS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CE103",
    "name": "Engineering Graphics",
    "school": "SOE",
    "dept": "CE",
    "progs": [
      "BEE"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CH401",
    "name": "Physical Chemistry-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CH403",
    "name": "Inorganic Chemistry-I",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CH405",
    "name": "Organic Chemistry-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CH407",
    "name": "Characterization Techniques -I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CH503",
    "name": "Green Chemistry",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CH505",
    "name": "Patent law and IPR issues",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CH509",
    "name": "Bio-Inorganic Chemistry",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH101",
    "name": "Inorganic Chemistry-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHH103",
    "name": "Inorganic Chem Lab",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHH105",
    "name": "Physical Chemistry-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHH107",
    "name": "Physical Chemistry Lab-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHH201",
    "name": "Inorganic Chemistry-II",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH203G1",
    "name": "Inorganic Chemistry Lab-II",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH203G2",
    "name": "Inorganic Chemistry lab-II",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH205",
    "name": "Organic Chemistry-II",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH207G1",
    "name": "Organic Chemistry lab-II",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH207G2",
    "name": "Organic Chemistry Lab-II",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH209",
    "name": "Physical Chemistry-III",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH211G1",
    "name": "Physical Chemistry lab-III",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH211G2",
    "name": "Physical Cheistry lab-III",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHH301",
    "name": "Organic Chemistry IV",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CHH303",
    "name": "Organic Chemistry Lab- IV",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CHH305",
    "name": "Physical Chemistry V",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CHH307",
    "name": "Physical Chemistry Lab- V",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CHH309",
    "name": "Industry and Environmental Chemistry",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CHH311",
    "name": "Industry and Environmental Chemistry Laboratory",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CHH401",
    "name": "Inorganic Chemistry-V",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHH403",
    "name": "Inorganic Chemistry lab-V",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHH405",
    "name": "Physical Chemistry-VI",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHH407",
    "name": "Physical Chemistry Lab-VI",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHH409",
    "name": "Organic chemistry-VI",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHH411",
    "name": "Organic Chemistry lab-VI",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHH413",
    "name": "Analytical Techniques-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHH415",
    "name": "Reasearch Methodology",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CHL401",
    "name": "Physical Chemistry Laboratory -I",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHL403",
    "name": "Inorganic Chemistry Lab-I",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHL405",
    "name": "Organic Chemistry Lab-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHM511",
    "name": "Medicinal Chemistry-I: Drug Development and Lead Optimization",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHM521",
    "name": "Medicinal Chemistry-II: Chemistry of Drugs Action",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHM531",
    "name": "Medicinal Chemistry-III: Contemporary and Combinatorial Approaches in Drug Discovery",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHML515",
    "name": "Medicinal Chemistry Laboratory-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHML525",
    "name": "Medicinal Chemistry Laboratory-II",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHML535",
    "name": "Medicinal Chemistry Laboratory-III",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHPO511",
    "name": "Polymer Chemistry-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHPO521",
    "name": "Polymer Chemistry-II: Structural Properties of Polymers",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHPO531",
    "name": "Polymer Chemistry-III: Industrial Polymer Chemistry",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHPOL515",
    "name": "Polymer Chemistry Laboratory-I",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHPOL525",
    "name": "Polymer Chemistry Laboratory-II",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHPOL535",
    "name": "Polymer Chemistry Laboratory-III",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHR509",
    "name": "Research Methodology",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "MAC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CHS101",
    "name": "Chemistry of Cosmetics products",
    "school": "SOVSAS",
    "dept": "CH",
    "progs": [
      "BHC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CHS201",
    "name": "Intellectual Property Rights",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CM301",
    "name": "Compiler Design",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM303",
    "name": "Soft Computing Techniques",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM305",
    "name": "Analysis and Design of algorithms",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM307",
    "name": "Big Data Analytics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM309",
    "name": "Machine Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM315",
    "name": "Data Mining",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM381",
    "name": "Analysis& Design of Algorithms Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM383",
    "name": "Big Data Anaytics Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM385",
    "name": "Machine Learning Lab using Python",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CM401",
    "name": "Parallel Processing and CUDA Programming",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CM403",
    "name": "Data Visualization",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CM405",
    "name": "Applied Machine Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CM415",
    "name": "Internet of Things",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CM425",
    "name": "Machine Intelligence for Medical Image Analysis",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CM481",
    "name": "Applied Machine Learning Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-ML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CS101",
    "name": "Problem Solving using C",
    "school": "SOBT",
    "dept": "CSE",
    "progs": [
      "BT",
      "BEE",
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS181",
    "name": "Computer Programming Lab - I",
    "school": "SOE",
    "dept": "ECE",
    "progs": [
      "BEE",
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS183",
    "name": "Problem Solving Using C Lab",
    "school": "SOBT",
    "dept": "CSE",
    "progs": [
      "BT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS205",
    "name": "Data Structure and Algorithms",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "UEL",
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CS301",
    "name": "Computer Networks",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "UEL",
      "ICS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS303",
    "name": "Compiler Design",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS305",
    "name": "Wireless Communication",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS",
      "BCS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS307",
    "name": "Python",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS317",
    "name": "Data Mining",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS",
      "BCS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS325",
    "name": "Graph Theory",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS327",
    "name": "Knowledge Engineering",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS381",
    "name": "Computer Networks Lab",
    "school": "SOICT",
    "dept": "CS",
    "progs": [
      "BCS",
      "ICS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS383",
    "name": "Compiler Design Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS385",
    "name": "Python Programming Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "CS401",
    "name": "Internet of Things",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "ICS",
      "UEL",
      "BCS"
    ],
    "sems": [
      "III",
      "IV"
    ]
  },
  {
    "code": "CS403",
    "name": "Soft Computing Techniques",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS",
      "BCS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CS405",
    "name": "Machine Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS",
      "BCS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CS407",
    "name": "Pattern Recognition",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CS417",
    "name": "Data Science Basics and Visualisation",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CS481",
    "name": "Internet of Things Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "ICS",
      "BCS"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "CS521",
    "name": "Advanced database management system",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MDS",
      "MTS",
      "MTA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS523",
    "name": "Advanced Data Structure and Algorithm",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MDS",
      "MTS",
      "MTA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS525",
    "name": "Research Techniques in ICT",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "MDS",
      "MTS",
      "MTA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS527",
    "name": "Python Programming",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTA",
      "MTS",
      "MDS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS581",
    "name": "Advanced Database Management System Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MDS",
      "MTA",
      "MTS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS583",
    "name": "Python Programming Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTS",
      "MTA",
      "MDS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS621",
    "name": "Cloud and Edge Computing",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTS",
      "MDS",
      "MTA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CS623",
    "name": "AI Methods for Software Engineering",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CS635",
    "name": "Advanced Software Testing",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CS649",
    "name": "Software Maintenance",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CS681",
    "name": "AI Assisted Software Engineering Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MTS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CS701",
    "name": "Artificial Intelligence Techniques",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "PhDCS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CS781",
    "name": "Artificial Intelligence Technique Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "PhDCS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CSE101",
    "name": "Problem Solving Using C",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "MOR",
      "ICS",
      "BEC",
      "CSE-Cyber",
      "CSE-DS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CSE183",
    "name": "Problem Solving Using C Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-Cyber",
      "CSE-DS",
      "BCS",
      "BEC",
      "ICS",
      "MOR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CSE201",
    "name": "Scientific Computing with Python",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS",
      "CSE-DS",
      "CSE-Cyber"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CSE203",
    "name": "Data Structures",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "CSE-Cyber",
      "CSE-DS",
      "ICS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CSE205",
    "name": "Database Management System",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS",
      "CSE-DS",
      "CSE-Cyber"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CSE207",
    "name": "Computer Organization and Architecture",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS",
      "BCS",
      "CSE-Cyber",
      "CSE-DS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CSE209",
    "name": "Operating System",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS",
      "UEL",
      "CSE-Cyber",
      "CSE-DS"
    ],
    "sems": [
      "II",
      "IV"
    ]
  },
  {
    "code": "CSE281",
    "name": "Scientific Computing with Python Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "CSE-DS",
      "ICS",
      "CSE-Cyber"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CSE283",
    "name": "Data Structures Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS",
      "BCS",
      "CSE-Cyber",
      "CSE-DS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CSE285",
    "name": "Database Management System Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "CSE-DS",
      "ICS",
      "CSE-Cyber"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "CY101",
    "name": "Engineering Chemistry",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "BT",
      "BEE"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "CY103",
    "name": "Engineering Chemistry Lab",
    "school": "SOE",
    "dept": "CH",
    "progs": [
      "BEE",
      "BT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EA301",
    "name": "Control Systems",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA303",
    "name": "Digital Signal Processing",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA305",
    "name": "Deep Learning",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA307",
    "name": "Microprocessor and Microcontroller",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA323",
    "name": "Introduction to Robotics",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA373",
    "name": "Digital Signal Processing Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA375",
    "name": "Deep Learning Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA377",
    "name": "Microprocessor and Microcontroller Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA379",
    "name": "Technical Report writing and Presentation",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EA401",
    "name": "Wireless Technologies",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA403",
    "name": "Multimodal Data Processing",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA405",
    "name": "AI Models and Pattern Recognition",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA407",
    "name": "Hybrid Soft Computing Model",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA421",
    "name": "Reliability Engineering",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA471",
    "name": "Wireless Technologies Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA472",
    "name": "Hybrid Soft Computing Model Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA473",
    "name": "Multimodal Data Processing Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EA475",
    "name": "AI Models and Pattern Recognition Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC-AIML"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC101",
    "name": "Basic Electronics Engineering",
    "school": "SOE",
    "dept": "ECE",
    "progs": [
      "BEE",
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EC109",
    "name": "Fundamental of Economics",
    "school": "SOVSAS",
    "dept": "EP",
    "progs": [
      "UHS",
      "BHM",
      "BHP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EC181",
    "name": "Basic Electronics Lab",
    "school": "SOE",
    "dept": "ECE",
    "progs": [
      "BEE",
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EC311",
    "name": "Data Analysis",
    "school": "SOHSS",
    "dept": "EP",
    "progs": [
      "BAEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC321",
    "name": "Digital Logic Design",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC323",
    "name": "Digital Communication",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC325",
    "name": "Antenna and Wave Propagation",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC327",
    "name": "Control System",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC343",
    "name": "Electronic Instrumentation and Measurements",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC371",
    "name": "Control System Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC373",
    "name": "Digital Communication Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC375",
    "name": "Digital Logic Design Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC377",
    "name": "Antenna and Wave propagation Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EC421",
    "name": "wireless Communication",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC423",
    "name": "Fiber Optic Communication",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC425",
    "name": "VLSI Design",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC441",
    "name": "Electronics Switiching Systems",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC455",
    "name": "Mobile Communication",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC471",
    "name": "Fiber Optic Communication Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC473",
    "name": "VLSI Design Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EC633",
    "name": "Low power VLSI design",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "EC"
    ],
    "sems": [
      "IX"
    ]
  },
  {
    "code": "EC665",
    "name": "VLSI ASIC Design",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "EC"
    ],
    "sems": [
      "IX"
    ]
  },
  {
    "code": "EC673",
    "name": "VLSI reliability engg",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "EC"
    ],
    "sems": [
      "IX"
    ]
  },
  {
    "code": "EC675",
    "name": "Mixed signal VLSI design",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "EC"
    ],
    "sems": [
      "IX"
    ]
  },
  {
    "code": "EC683",
    "name": "Design Lab II",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "EC"
    ],
    "sems": [
      "IX"
    ]
  },
  {
    "code": "ECE101",
    "name": "Electronics and Electrical Engineering",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BCS",
      "BAI",
      "BIT",
      "BEC",
      "CSE-DS",
      "CSE-Cyber"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ECE121",
    "name": "Emerging trends in ICT",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ECE185",
    "name": "Electronics and Electrical Engineering Lab",
    "school": "SOICT",
    "dept": "EE",
    "progs": [
      "BCS",
      "BEC",
      "BAI",
      "BIT",
      "CSE-DS",
      "CSE-Cyber"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ECE201",
    "name": "Electronic Devices and Circuits",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ECE203",
    "name": "Electromagnetic Waves",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ECE205",
    "name": "Signals and Systems",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ECE207",
    "name": "Network Theory",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ECE281",
    "name": "Electronic Device Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ECE283",
    "name": "Network Theory Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE201",
    "name": "Network Theory",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BEE",
      "UEL",
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE203",
    "name": "Electrical Engineering Materials & Nano Materials",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE204",
    "name": "Electronic Devices and Circuits (EDC)",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE205",
    "name": "EMMI",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "UEL"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE207",
    "name": "Electrical Machine-I",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE211",
    "name": "Network  Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL",
      "BEE"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE213",
    "name": "EMMI Lab",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BEE",
      "UEL"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE214",
    "name": "Electronic Devices and Circuits Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE215",
    "name": "Electrical Machine-I Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE301",
    "name": "Power System Analysis",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BEE",
      "UEL"
    ],
    "sems": [
      "III",
      "IV"
    ]
  },
  {
    "code": "EE303",
    "name": "Electromagnetic Field Theory",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BEE"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE305",
    "name": "Linear Control System",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "URA",
      "UEL"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE307",
    "name": "Power Electronics",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "UEL",
      "BEE"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE309",
    "name": "Digital Electronics",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE310",
    "name": "Microprocessor and Microcontroller",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE311",
    "name": "Power System Lab",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BEE",
      "UEL"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE313",
    "name": "Control System Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "URA",
      "UEL"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE315",
    "name": "Power Electronics Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL",
      "BEE"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE316",
    "name": "Microprocessor and Microcontroller Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE317",
    "name": "Digital Electronics Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE319",
    "name": "Industrial Training",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "UEL",
      "URA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EE401",
    "name": "Engineering Optimization",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "EE",
      "BEE"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE403",
    "name": "PLC & SCADA",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "EE",
      "UEL"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE407",
    "name": "Power System Operation & Control",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE481",
    "name": "PLC & SCADA Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "EE"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE483",
    "name": "DSP Lab",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BEE",
      "EE"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE485",
    "name": "Industrial Training",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL",
      "BEE",
      "EE"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE487",
    "name": "Seminar",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BEE",
      "UEL"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE497",
    "name": "Project-I",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "UEL"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EE571",
    "name": "Power system analysis and control",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EE573",
    "name": "Power system Transients",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EE581",
    "name": "Restructured Power System",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EE591",
    "name": "Power System Lab",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EE597",
    "name": "Seminar",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EE671",
    "name": "Power System Dynamics and control",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "MTP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE673",
    "name": "HVDC & Facts",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE681",
    "name": "Soft computing Techniques",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "BEE",
      "MTP",
      "EE"
    ],
    "sems": [
      "II",
      "IV"
    ]
  },
  {
    "code": "EE683",
    "name": "Distributed Generation and Microgrids",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE685",
    "name": "SCADA and Phasor Measurment Unit",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "MTP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE697",
    "name": "Distribution Network Lab",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE699",
    "name": "Dissertation-I",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "MTP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EE717",
    "name": "Sp. El. I (AI Techniques in Power Systems)",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "EE"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "EEC201",
    "name": "Object Oriented Programming",
    "school": "SOE",
    "dept": "IT",
    "progs": [
      "UEL"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EEC309",
    "name": "Innovation & Entrepreneurship",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EEC317",
    "name": "Mini Project - I (Creativity & Design)",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ELC305",
    "name": "Principals of Machine Learning",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "UEL"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EN101",
    "name": "English Profiency",
    "school": "SOICT",
    "dept": "EP",
    "progs": [
      "ICS",
      "BCS",
      "BT",
      "BIT",
      "BCA",
      "UES",
      "BHC",
      "BHP",
      "BHM",
      "UHS",
      "CSE-DS",
      "BEE",
      "CSE-Cyber",
      "BEC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EN105",
    "name": "Communicative English",
    "school": "SOHSS",
    "dept": "EP",
    "progs": [
      "UHB",
      "MEN",
      "UBT",
      "IBTAB",
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EN151",
    "name": "Language Lab (Practical)",
    "school": "SOVSAS",
    "dept": "EN",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EN531",
    "name": "Language, Culture and Society",
    "school": "SOE",
    "dept": "EN",
    "progs": [
      "MTP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "EN603",
    "name": "General Linguistics",
    "school": "SOHSS",
    "dept": "EP",
    "progs": [
      "MEN"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ENG211",
    "name": "Bhasha Writing",
    "school": "SOVSAS",
    "dept": "EN",
    "progs": [
      "BHP",
      "BHM",
      "UHS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ES101",
    "name": "Environmental Studies",
    "school": "SOICT",
    "dept": "ES",
    "progs": [
      "BEC",
      "ICS",
      "BCOM",
      "BCS",
      "BIT",
      "CSE-DS",
      "CSE-Cyber",
      "BHC",
      "BHP",
      "BHM",
      "UHS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ES415",
    "name": "Energy and Environment",
    "school": "SOICT",
    "dept": "ES",
    "progs": [
      "MTA",
      "MTS",
      "MDS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ES417",
    "name": "Disaster Management",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BME",
      "BEE"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ES501",
    "name": "Environmental Toxicology and Bioremediation",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ES503",
    "name": "Biodiversity and Environmental Conservation",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ES505",
    "name": "Remote Sensing and Geographic Information System",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ES507",
    "name": "Waste managemant",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES",
      "MFS"
    ],
    "sems": [
      "I",
      "II"
    ]
  },
  {
    "code": "ES509",
    "name": "Environmental Impact Assessment & Sustainable Development",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ES511",
    "name": "Advanced Analytical Techniques for Environmental Monitoring",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ES513",
    "name": "Research Methodology",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MFS",
      "MES",
      "MTF",
      "MAP"
    ],
    "sems": [
      "I",
      "II"
    ]
  },
  {
    "code": "ES521",
    "name": "Laboratory-III",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "EV301",
    "name": "Digital IC Design",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EV303",
    "name": "Embeddded Systems",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EV317",
    "name": "PCB design and Manufacturing",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EV319",
    "name": "Digital Signal Processing",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EV371",
    "name": "Digital IC Design Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "EV373",
    "name": "Embeddded Systems Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FS401",
    "name": "Food Process Technology I",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FS403",
    "name": "Food Microbiology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FS405",
    "name": "Food Chemistry and Nutrition",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FS407",
    "name": "Technology of Food Processing & Preservation",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FS409",
    "name": "Food Safety and Quality",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FS411",
    "name": "Food  Chemistry Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FS413",
    "name": "Food Microbiology Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FS501",
    "name": "Advances in Food Process Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS503",
    "name": "Food Packaging Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS505",
    "name": "Techniques in Food Analysis",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS507",
    "name": "Technology of Milk and Milk Products",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS509",
    "name": "Tech. of Fermented Foods",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS521",
    "name": "Advance Food Processing Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS523",
    "name": "Dairy Technology Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS525",
    "name": "Technology of Beverages",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FS555",
    "name": "Training",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MFS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT201",
    "name": "Principles of Food Preservation",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT203",
    "name": "Food Microbiology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT205",
    "name": "Food Chemistry and Nutrition",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UFT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT251",
    "name": "Food Microbiology Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT301",
    "name": "Food Packaging",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FT303",
    "name": "Fruits and Vegetable Processing",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FT305",
    "name": "Advances in Food Process Technology",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UFT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FT311",
    "name": "FOOD ADDITIVES",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FT315",
    "name": "Analytical Techniques in Food Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FT353",
    "name": "Food Quality- analysis and assurance Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FT355",
    "name": "Fruits Vegetable Milk Products Proecc. Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "FT401",
    "name": "Bakery and Confectionary Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT403",
    "name": "Food Storage Engineering",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT405",
    "name": "Dairy Process Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT411",
    "name": "Meat Fish Poultry Processing Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT413",
    "name": "Functional Foods and Nutraceuticals",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT417",
    "name": "Food Safety, Quality and Regulation",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT453",
    "name": "TRAINING -II",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT455",
    "name": "Project I",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT503",
    "name": "Engg properties of Biomaterials and Application",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FT505",
    "name": "Advances in Food Process Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FT507",
    "name": "Food Safety and Standards",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FT511",
    "name": "FOOD BEVERAGE",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MTF"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FT513",
    "name": "Experimental Design And Statistics",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FT515",
    "name": "Advanced Food Chemistry and Micribiology Lab",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MTF"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FT518",
    "name": "Advaced Food Chemistry and Microbiology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FT551",
    "name": "Advance Food Processing lab I",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT553",
    "name": "Research Problem Identification/Project Formulation",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "UFT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "FT601",
    "name": "Advanced Food Packaging",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT603",
    "name": "Instrumental Techniques in Food  Analysis",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT607",
    "name": "Advances in Dairy engg and Tech.",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT609",
    "name": "Food Industry Waste management",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT611",
    "name": "Flavour Technology",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT615",
    "name": "IPR and Patenting in Food Tech.",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT651",
    "name": "Seminar-II",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT653",
    "name": "Dissertation-I",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT655",
    "name": "Advanced Food Processing Lab III",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FT657",
    "name": "Advanced Food Qualuty Lab",
    "school": "SOVSAS",
    "dept": "FT",
    "progs": [
      "MTF"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "FTMA101",
    "name": "Engineering Mathematics I",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UFT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "FTMA201",
    "name": "Mathematics III",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UFT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "HN105",
    "name": "Bhasha avam Sanskriti",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "HS101",
    "name": "ICT &Application-I",
    "school": "SOHSS",
    "dept": "EP",
    "progs": [
      "BAEC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ICT01",
    "name": "Electronics and Electrical Engineering",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "ICS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ICT101",
    "name": "Career Skills",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BEC",
      "BCA",
      "BIT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ICT103",
    "name": "Career Skills",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BAI",
      "CSE-Cyber",
      "CSE-DS",
      "BCS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ICT181",
    "name": "ICT Workshop I",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "CSE-DS",
      "BAI",
      "CSE-Cyber",
      "BCS",
      "BEC",
      "BIT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ICT81",
    "name": "ICT Workshop I",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "BCS",
      "ICS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ICT85",
    "name": "Electronics and Electrical Engineering Lab",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "BAI",
      "ICS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "ICTV1",
    "name": "Career Skills",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "ICS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "IPM211",
    "name": "Myths and Facts in Mental Health",
    "school": "SOICT",
    "dept": "PM",
    "progs": [
      "BIT",
      "BCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "IT301",
    "name": "Theory of Automata",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT303",
    "name": "Computer Networks",
    "school": "SOICT",
    "dept": "CS",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT305",
    "name": "Compiler Design",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT307",
    "name": "Soft Computing Techniques",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT311",
    "name": "Advanced Communication Systems",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT321",
    "name": "Information Retrieval System",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT381",
    "name": "Computer Networks Lab",
    "school": "SOICT",
    "dept": "CS",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT383",
    "name": "Compiler Design Lab",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT385",
    "name": "Soft Computing Techniques Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "IT401",
    "name": "Sensor Networks and IoT",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "IT403",
    "name": "Management Information System",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "IT405",
    "name": "Big Data Analytics",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT",
      "UFT"
    ],
    "sems": [
      "III",
      "IV"
    ]
  },
  {
    "code": "IT409",
    "name": "Mobile Computing",
    "school": "SOICT",
    "dept": "CS",
    "progs": [
      "BIT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "IT481",
    "name": "Sensor Networks and IoT Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "BIT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "MA006",
    "name": "Discrete Mathematics",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MAM"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MA028",
    "name": "Mathematical Modelling with MatLab/Python",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MAM"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MA0401",
    "name": "Modeling and Simulation",
    "school": "SOICT",
    "dept": "MA",
    "progs": [
      "BIT"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "MA101",
    "name": "Engineering Mathamatics-I",
    "school": "SOE",
    "dept": "MA",
    "progs": [
      "BEE",
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MA103",
    "name": "Mathematics",
    "school": "SOBT",
    "dept": "MA",
    "progs": [
      "BT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MA111",
    "name": "Applied Mathematics-1",
    "school": "SOICT",
    "dept": "MA",
    "progs": [
      "BEC",
      "BCS",
      "BIT",
      "CSE-Cyber",
      "CSE-DS",
      "BAI",
      "ICS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MA151",
    "name": "Mathematical Foundation of Computer Science-I",
    "school": "SOICT",
    "dept": "MA",
    "progs": [
      "BCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MA201",
    "name": "Engineering Mathmatics III",
    "school": "SOE",
    "dept": "MA",
    "progs": [
      "BME",
      "BEE",
      "UEL",
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MA203",
    "name": "Quatative Techniques in Biotechnology",
    "school": "SOBT",
    "dept": "MA",
    "progs": [
      "BT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MA401",
    "name": "Advanced Linear Algebra",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MAM",
      "BHM",
      "PHD-MATHS"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "MA402",
    "name": "Simulation & modelling",
    "school": "SOE",
    "dept": "MA",
    "progs": [
      "MTP",
      "BCS",
      "ICS"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "MA403",
    "name": "Abstract Algebra",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MAM",
      "BHM"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "MA405",
    "name": "Advanced Real Analysis",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM",
      "MAM"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "MA407",
    "name": "Advanced Ordinary Differential Equations",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "BHM",
      "MAM"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "MA409",
    "name": "Number Theory and Cryptography",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MAM",
      "BHM"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "MA415",
    "name": "Biostatistics",
    "school": "SOBT",
    "dept": "MA",
    "progs": [
      "MTB",
      "BT"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "MA503",
    "name": "Integral Equations and Calculas of Variations",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MAM"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MA509",
    "name": "Numerical Optimization",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MAM"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MAI101",
    "name": "Artificial Intelligence",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MAI181",
    "name": "Artificial Intelligence Lab",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MAI201",
    "name": "Deep Learning",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MAI203",
    "name": "Agentic AI",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MAI205",
    "name": "Expert System Design",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MAI215",
    "name": "Prompt Engineering",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MAI281",
    "name": "Deep Learning Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MAI283",
    "name": "Agentic AI Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MB453",
    "name": "Managerial Economics",
    "school": "SOM",
    "dept": "MB",
    "progs": [
      "MBA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MB457",
    "name": "Organizational Behaviour",
    "school": "SOICT",
    "dept": "MB",
    "progs": [
      "BCS"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MB595",
    "name": "fundamentals of python programming",
    "school": "SOM",
    "dept": "CSE",
    "progs": [
      "MBA"
    ],
    "sems": [
      ""
    ]
  },
  {
    "code": "MBA451",
    "name": "FINANCIAL ACCOUNTING & ANALYSIS",
    "school": "SOM",
    "dept": "MB",
    "progs": [
      "MBA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCA101",
    "name": "Object Oriented Programming",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCA103",
    "name": "Python Programming",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCA105",
    "name": "Discrete Mathematics",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCA107",
    "name": "Software Engineering",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCA181",
    "name": "Object Oriented Programming Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCA183",
    "name": "Python Programming Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCA201",
    "name": "Compiler Design",
    "school": "SOICT",
    "dept": "NA",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MCB001",
    "name": "Computer Fundamental and Programming",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCB003",
    "name": "Introduction to Internet Technology",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCB005",
    "name": "Fundamental of Operating Systems",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCB007",
    "name": "Mathematical Foundation of Computer Science-I",
    "school": "SOICT",
    "dept": "MA",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCB081",
    "name": "Fundamental of Operating System Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MCB083",
    "name": "Internet Technology Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MDS101",
    "name": "Data Science",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MDS181",
    "name": "Data Science Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MDS201",
    "name": "Data Engineering",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MDS203",
    "name": "R Programming",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MDS205",
    "name": "Data Privacy and Security",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MDS213",
    "name": "Infomration Retrieval Systems",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MDS281",
    "name": "Data Engineering Lab",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "MDS283",
    "name": "R Programming Lab",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "MCA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME201",
    "name": "Theory of Production Process - I",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BME"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME203",
    "name": "Strength of Materials - I",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME205",
    "name": "Engineering Thermodynamic",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME207",
    "name": "Materials Engineering",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME209",
    "name": "Production Processes Lab - I",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME211",
    "name": "Strength of Materials Lab",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME213",
    "name": "Machine Drawing",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BME"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME221",
    "name": "Mechanics of Engineering Materials and Solids",
    "school": "SOVSAS",
    "dept": "ME",
    "progs": [
      "UFT"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "ME301",
    "name": "Design of Machine Elements - I",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME303",
    "name": "Applied Thermodynamics",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME305",
    "name": "Fluid Machines",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME307",
    "name": "Dynamics of Machines",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME309",
    "name": "Heat and Mass transfer",
    "school": "SOVSAS",
    "dept": "ME",
    "progs": [
      "UFT",
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME311",
    "name": "Mechanical Vibrations",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME313",
    "name": "Fluid Machines Lab",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME315",
    "name": "Heat and Mass Transfer Lab",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME317",
    "name": "DOM and Vibrations Lab",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "ME401",
    "name": "Project - I",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ME403",
    "name": "Seminar",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ME407",
    "name": "Production Planning and Control",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ME409",
    "name": "Industrial Traning",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ME411",
    "name": "Power Plant Engineering",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "UEL",
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ME417",
    "name": "Renewable Energy Resources",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "EE",
      "UEL",
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ME419",
    "name": "Non-conventional Mnufacturing Processes",
    "school": "SOE",
    "dept": "ME",
    "progs": [
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "ME425",
    "name": "Basics of Operations Research",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "BME"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "MES501",
    "name": "Environmental Pollution",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES503",
    "name": "Earth System Science",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES505",
    "name": "Energy and Environment",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES507",
    "name": "Environmental Law and Policies",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES509",
    "name": "Scientific Writing and Communication Skills",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES511",
    "name": "Introduction to Sustainable Development",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES513",
    "name": "Environmental Statistics",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES517",
    "name": "Fundamentals of Environmental Studies",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES519",
    "name": "Laboratory-1: Environmental Monitoring and Field Visit",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MES521",
    "name": "Ecology and Biodiversity",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "MES"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MNMT101",
    "name": "Human Anatomy and Physiology for Nuclear Medicine",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "NMT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MNMT103",
    "name": "Nuclear Medicine Physics and Instrumentation",
    "school": "SOBT",
    "dept": "PH",
    "progs": [
      "NMT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MNMT105",
    "name": "Radiological Physics, Safety and Regulatory Planing of Facility",
    "school": "SOBT",
    "dept": "PH",
    "progs": [
      "NMT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MNMT107",
    "name": "Research Publication Ethics & Pedagogy",
    "school": "SOBT",
    "dept": "BT",
    "progs": [
      "NMT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MNMT109",
    "name": "Practicum-I",
    "school": "SOBT",
    "dept": "PH",
    "progs": [
      "NMT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MNMT111",
    "name": "Clinical Practice-I",
    "school": "SOBT",
    "dept": "PH",
    "progs": [
      "NMT"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MOR401",
    "name": "Linear Programming with Applications-II",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MOR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MOR403",
    "name": "Inventory Management",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MOR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MOR405",
    "name": "Sampling Distributions and Statistical Inference",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MOR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MOR407",
    "name": "Linear Programming Lab",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MOR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "MOR409",
    "name": "Web Designing and LATEX",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "MOR"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "OE329",
    "name": "Machine Learning",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH102",
    "name": "Engineering Physics",
    "school": "SOICT",
    "dept": "PH",
    "progs": [
      "BAI"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH104",
    "name": "Engineeing Physics Lab",
    "school": "SOICT",
    "dept": "PH",
    "progs": [
      "BAI"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH111",
    "name": "Mechanics",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH111L",
    "name": "Mechanics Lab",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH113",
    "name": "Waves and Oscillations",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH113L",
    "name": "Waves and Oscillations Lab",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH115",
    "name": "Vector Analysis",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH117",
    "name": "Introduction to SciLab",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH211",
    "name": "Mathematical Physics II",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PH213",
    "name": "Mathematical Physics II Lab",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PH215",
    "name": "Thermal Physics",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PH217",
    "name": "Thermal Physics Lab",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PH219",
    "name": "Digital System and Applications",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PH221",
    "name": "Digital System and Applications Lab",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PH225",
    "name": "Introduction to Machine Learning",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PH311",
    "name": "Quantum Mechanics & Applications",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH313",
    "name": "Quantum Mechanics  Lab",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH315",
    "name": "Solid State Physics",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH317",
    "name": "Solid State Physics Lab",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH319",
    "name": "Classical Dynamics & Realativity",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH321",
    "name": "Atmospheric Physics",
    "school": "SOVSAS",
    "dept": "ES",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH325",
    "name": "Renewable Energy and Energy Harvesting",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH329",
    "name": "Radiation Physics",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "BHP"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "PH411",
    "name": "Classical Mechanics",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "MAP",
      "MAM"
    ],
    "sems": [
      "I",
      "II"
    ]
  },
  {
    "code": "PH413",
    "name": "Electrodynamics",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP",
      "MAP"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "PH415",
    "name": "Statistical Physics",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PH417",
    "name": "Technical Writing",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP",
      "BHP"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "PH419",
    "name": "Physics Laboratory I",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP",
      "BHP"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "PH421",
    "name": "Optical Fiber Communication",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP",
      "BHP"
    ],
    "sems": [
      "I",
      "IV"
    ]
  },
  {
    "code": "PH427",
    "name": "Nuclear and Particle Physics",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "BHP"
    ],
    "sems": [
      "IV"
    ]
  },
  {
    "code": "PHE503",
    "name": "Energy Technology and Energy Storage System",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP",
      "BHP"
    ],
    "sems": [
      "II",
      "IV"
    ]
  },
  {
    "code": "PHE505",
    "name": "Characterization of Materials",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PHE507",
    "name": "Nanoscience and Nanotechnology",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PHM501",
    "name": "Atomic and Moleculer Physics",
    "school": "SOVSAS",
    "dept": "PH",
    "progs": [
      "MAP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PM105",
    "name": "Social & Emotional Wellbeing",
    "school": "SOBT",
    "dept": "NA",
    "progs": [
      "UFS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PM108",
    "name": "Living with stress",
    "school": "SOVSAS",
    "dept": "PM",
    "progs": [
      "BHC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "PM111",
    "name": "Social and Emotional Well-being",
    "school": "SOICT",
    "dept": "PM",
    "progs": [
      "BIT",
      "BCA",
      "BEC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "PM211",
    "name": "Applied Psychometry",
    "school": "SOICT",
    "dept": "PM",
    "progs": [
      "BEC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "RAI203",
    "name": "Analog & Digital Electronics",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "RAI205",
    "name": "Fundamentals of Robotics",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA",
      "BHP"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "RAI207",
    "name": "Fundamentals of Artificial Intelligence",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "RAI211",
    "name": "Network Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "RAI213",
    "name": "Analog & Digital Electronics Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "RAI215",
    "name": "Robotics & AI Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "RAI301",
    "name": "Kinematics and dynamics of Robotics",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "RAI303",
    "name": "AI & Expert Systems",
    "school": "SOE",
    "dept": "NA",
    "progs": [
      "URA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "RAI307",
    "name": "Industrial Electronics",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "RAI309",
    "name": "Wireless communication",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "RAI313",
    "name": "Industrial Electronics Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "RAI315",
    "name": "Robot Dynamics Lab",
    "school": "SOE",
    "dept": "EE",
    "progs": [
      "URA"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "RI760",
    "name": "Research Methodologies",
    "school": "SOICT",
    "dept": "IT",
    "progs": [
      "PhDCS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "RPE601",
    "name": "Research and Publication Ethics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "PhDCS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "UMC103",
    "name": "Environmental Studies",
    "school": "SOVSAS",
    "dept": "NA",
    "progs": [
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "UMC109",
    "name": "Foundation of Data Science in Python",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "UMC113",
    "name": "Data Science Lab",
    "school": "SOVSAS",
    "dept": "CSE",
    "progs": [
      "UMC"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "UMC201",
    "name": "Data Structures and Algorithms",
    "school": "SOVSAS",
    "dept": "CSE",
    "progs": [
      "UMC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "UMC203",
    "name": "Real and complex Analysis",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UMC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "UMC205",
    "name": "Discrete Structures",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UMC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "UMC207",
    "name": "Probability and Applied Statistical Methods",
    "school": "SOVSAS",
    "dept": "MA",
    "progs": [
      "UMC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "UMC211",
    "name": "Fundamentals of Management",
    "school": "SOVSAS",
    "dept": "MB",
    "progs": [
      "UMC"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "VA303",
    "name": "Critical and Creative Thinking Skills",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PVD"
    ],
    "sems": [
      "III"
    ]
  },
  {
    "code": "VAC101",
    "name": "Constitution of India",
    "school": "SOICT",
    "dept": "LB",
    "progs": [
      "CSE-DS",
      "BCS",
      "CSE-Cyber",
      "ICS"
    ],
    "sems": [
      "I"
    ]
  },
  {
    "code": "WCS621",
    "name": "Machine Learning",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "PCW"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "WCS623",
    "name": "Data Analytics",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "PCW"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "WCS639",
    "name": "AI Enabled Cyber Security",
    "school": "SOICT",
    "dept": "CSE",
    "progs": [
      "PCW"
    ],
    "sems": [
      "II"
    ]
  },
  {
    "code": "WCS643",
    "name": "Internet of Things",
    "school": "SOICT",
    "dept": "ECE",
    "progs": [
      "PCW"
    ],
    "sems": [
      "II"
    ]
  }
];
