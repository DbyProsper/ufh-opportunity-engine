// Official UFH faculties and departments
export const UFH_FACULTIES: Record<string, string[]> = {
  "Faculty of Education": [
    "Teacher Education",
    "Curriculum Studies",
    "Educational Psychology",
  ],
  "Faculty of Health Sciences": [
    "Nursing Science",
    "Public Health",
    "Human Movement Science",
  ],
  "Faculty of Law (Nelson R. Mandela School of Law)": [
    "Public Law",
    "Private Law",
    "Criminal & Procedural Law",
  ],
  "Faculty of Management & Commerce": [
    "Accounting",
    "Economics",
    "Business Management",
    "Public Administration",
    "Information Systems",
    "Industrial Psychology",
  ],
  "Faculty of Science & Agriculture": [
    "Computer Science",
    "Mathematics",
    "Statistics",
    "Physics",
    "Chemistry",
    "Botany",
    "Zoology",
    "Agricultural Economics",
    "Agronomy",
    "Biochemistry & Microbiology",
  ],
  "Faculty of Social Sciences & Humanities": [
    "Languages & Communication",
    "Politics & Philosophy",
    "Psychology, Social Work & Criminology",
    "Sociology & Anthropology",
    "Visual & Performing Arts",
    "Liberation Studies",
  ],
};

export const UFH_FACULTY_NAMES = Object.keys(UFH_FACULTIES);

// UFH email domains allowed for signup
export const UFH_EMAIL_DOMAINS = [
  "ufh.ac.za",
  "mail.ufh.ac.za",
  "live.ufh.ac.za",
  "myuwc.ac.za", // remove if not wanted
];

export const UFH_EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@(ufh\.ac\.za|mail\.ufh\.ac\.za|live\.ufh\.ac\.za)$/i;

export const isUFHEmail = (email: string) => UFH_EMAIL_REGEX.test(email.trim());
