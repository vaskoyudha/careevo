export interface ProgramCourse {
  number: number;
  title: string;
  hours: string;
  rating: number;
  description: string;
  thumbnail: string;
}

export interface ProgramDetails {
  slug: string;
  type: "Specialization" | "Professional Certificate";
  title: string;
  subtitle: string;
  provider: string;
  providerLogo: string;
  instructor: string;
  instructorRole: string;
  instructorBio: string;
  instructorAvatar: string;
  bannerGraphic?: string;
  thumbnail?: string;
  rating: number;
  reviews: string;
  enrolled: string;
  startDate: string;
  category: string;
  subcategory: string;
  seriesCount: number;
  level: "Beginner level" | "Intermediate level" | "Advanced level";
  durationWeeks: number;
  hoursPerWeek: number;
  pace: string;
  whatYouWillLearn: string[];
  skills: string[];
  tools: string[];
  courses: ProgramCourse[];
}

export const PROGRAMS_REGISTRY: Record<string, ProgramDetails> = {
  "complete-claude-code-claude-cowork-masterclass": {
    slug: "complete-claude-code-claude-cowork-masterclass",
    type: "Specialization",
    title: "The Complete Claude Code & Claude Cowork Masterclass Specialization",
    subtitle:
      "Kuasai Claude untuk kerja dan aplikasi. Otomatiskan alur kerja, bangun aplikasi, dan buat agen AI pribadi dengan Claude",
    provider: "Digital & AI Academy",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/eb/462677a34a4d8bb160038d2a8fe758/Untitled-design-6-.png?auto=format%2Ccompress&dpr=1&h=45",
    instructor: "Dr. Ryan Ahmed",
    instructorRole: "Pakar AI, Pengajar Bestseller & Pendidik Teknologi",
    instructorBio:
      "Dr. Ryan Ahmed adalah peneliti AI, profesor universitas, dan pengusaha dengan lebih dari 500.000 pelajar di seluruh dunia. Ia membaktikan diri pada penerapan AI praktis, membantu pengembang perangkat lunak dan pekerja pengetahuan menaikkan produktivitas lewat LLM, pengodean otonom, serta pipeline alur kerja cerdas.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-instructor-photos.s3.amazonaws.com/0f/8af4a501964eb58b75f4484a0e35b3/AI-AGENTS-24-.jpg?auto=format%2Ccompress&dpr=1&w=75&h=75&fit=crop",
    bannerGraphic:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/eb/462677a34a4d8bb160038d2a8fe758/Untitled-design-6-.png?auto=format%2Ccompress&dpr=1&h=45",
    thumbnail: "/images/programs/claude-code-masterclass.jpg",
    rating: 4.9,
    reviews: "2.3K",
    enrolled: "2,348",
    startDate: "Starts Sep 24",
    category: "Computer Science",
    subcategory: "Software Development",
    seriesCount: 5,
    level: "Beginner level",
    durationWeeks: 4,
    hoursPerWeek: 10,
    pace: "Jadwal fleksibel",
    whatYouWillLearn: [
      "Gunakan Claude Chat, Cowork, skills, plugin, dan konektor MCP untuk mengotomatiskan alur kerja profesional",
      "Terapkan Claude di Excel dan PowerPoint untuk membersihkan data serta menyusun presentasi",
      "Bangun aplikasi dan agen AI dengan Claude Code serta arsitektur agen terstruktur",
    ],
    skills: [
      "Presentations",
      "Data Analysis",
      "Email Automation",
      "Financial Modeling",
      "Data Visualization",
      "Business Modeling",
      "Generative AI Agents",
      "Research Reports",
      "Software Engineering",
    ],
    tools: [
      "Anthropic Claude",
      "Claude Code",
      "AI Workflows",
      "Microsoft PowerPoint",
      "Microsoft Office",
      "AI Orchestration",
      "Microsoft Excel",
      "Model Context Protocol",
      "Prompt Engineering",
      "Vibe coding",
      "Agentic Workflows",
    ],
    courses: [
      {
        number: 1,
        title: "Claude Cowork, Skills and Plugins for Workflow Automation",
        hours: "4 jam",
        rating: 4.9,
        description:
          "Siapkan Claude Cowork, konfigurasi skills, sambungkan API eksternal via MCP, dan bangun pipeline otomatis harian.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/a8/adfce2daba479f9899859f4a69f438/3.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 2,
        title: "Claude Chat Mastery",
        hours: "2 jam",
        rating: 4.8,
        description:
          "Kuasai rekayasa prompt lanjutan, pembuatan artefak, dan pengarahan persona untuk tugas bisnis.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/ca/c14c8d469c439cacf99a3019a4f5f9/1.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 3,
        title: "AI-Powered Productivity: Claude in MS Office",
        hours: "4 jam",
        rating: 4.8,
        description:
          "Manfaatkan Claude di Excel untuk pemodelan dinamis dan di PowerPoint untuk menyusun presentasi.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/f9/0408191c0c4e41807b32756176d46e/4.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 4,
        title: "Building Apps and AI Agents with Claude Code",
        hours: "9 jam",
        rating: 4.9,
        description:
          "Pelajari rekayasa AI berbasis terminal dengan Claude Code CLI: scaffold aplikasi, tulis tes, dan orkestrasi subagen.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/c4/8139acf9b542419e9b6c739c58e340/2.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 5,
        title: "Capstone Course: Build Your Personal Agent",
        hours: "9 jam",
        rating: 4.9,
        description:
          "Gabungkan semua materi dengan membuat alur kerja agen otonom yang punya memori persisten dan evaluasi terverifikasi.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/bc/76fb17986b448e893b581d62d779eb/5.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
    ],
  },
  "google-project-management": {
    slug: "google-project-management",
    type: "Professional Certificate",
    title: "Google Project Management Professional Certificate",
    subtitle:
      "Masuk jalur cepat menuju karier manajemen proyek. Pelajari keterampilan yang sedang dicari pasar, dan dapatkan pelatihan AI dari pakarnya. Belajar dengan kecepatanmu sendiri tanpa ijazah.",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Google Career Certificates",
    instructorRole: "Pakar Industri & Pemimpin Teknis di Google",
    instructorBio:
      "Google Career Certificates menyiapkan pencari kerja untuk karier awal di bidang yang tumbuh cepat.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=75&h=75",
    thumbnail: "/images/programs/google-project-management.jpg",
    rating: 4.8,
    reviews: "120K",
    enrolled: "1,450,000",
    startDate: "Starts Today",
    category: "Business",
    subcategory: "Project Management",
    seriesCount: 6,
    level: "Beginner level",
    durationWeeks: 6,
    hoursPerWeek: 10,
    pace: "Jadwal fleksibel",
    whatYouWillLearn: [
      "Pahami praktik dan keterampilan dasar untuk peran manajemen proyek jenjang awal",
      "Buat dokumentasi proyek, artefak manajemen risiko, dan rencana milestone yang efektif",
      "Kuasai kerangka kerja Agile dan Scrum, termasuk sprint dan backlog",
    ],
    skills: [
      "Project Planning",
      "Risk Management",
      "Agile Methodology",
      "Scrum Ceremonies",
      "Budgeting & Procurement",
      "Stakeholder Communication",
      "Work Breakdown Structures",
    ],
    tools: [
      "Asana",
      "Jira",
      "Google Sheets",
      "Google Docs",
      "Gantt Charts",
      "Kanban Boards",
    ],
    courses: [
      {
        number: 1,
        title: "Foundations of Project Management",
        hours: "18 jam",
        rating: 4.9,
        description:
          "Pelajari dasar manajemen proyek serta peran dan jalur karier yang tersedia.",
        thumbnail:
          "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=320&h=180&q=80",
      },
      {
        number: 2,
        title: "Project Initiation: Starting a Successful Project",
        hours: "22 jam",
        rating: 4.8,
        description:
          "Tetapkan tujuan proyek, tentukan hasil kerja, hitung ROI, dan lengkapi charter proyek.",
        thumbnail:
          "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=320&h=180&q=80",
      },
      {
        number: 3,
        title: "Project Planning: Putting It All Together",
        hours: "24 jam",
        rating: 4.8,
        description:
          "Susun jadwal proyek, identifikasi milestone, petakan jalur kritis, dan draf register manajemen risiko.",
        thumbnail:
          "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=320&h=180&q=80",
      },
    ],
  },
  "google-data-analytics": {
    slug: "google-data-analytics",
    type: "Professional Certificate",
    title: "Google Data Analytics Professional Certificate",
    subtitle:
      "Masuk jalur cepat menuju karier analitik data. Kuasai keterampilan yang sedang dicari dan pengalaman praktis memakai spreadsheet, SQL, Tableau, serta R dari pakarnya.",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Google Career Certificates",
    instructorRole: "Analis Data & Insinyur di Google",
    instructorBio:
      "Disusun oleh analis data Google. Program ini memberi keterampilan praktis untuk mengumpulkan, mentransformasi, membersihkan, dan memvisualisasikan data.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=75&h=75",
    thumbnail: "/images/programs/google-data-analytics.jpg",
    rating: 4.8,
    reviews: "140K",
    enrolled: "2,100,000",
    startDate: "Starts Today",
    category: "Data Science",
    subcategory: "Data Analysis",
    seriesCount: 8,
    level: "Beginner level",
    durationWeeks: 6,
    hoursPerWeek: 10,
    pace: "Jadwal fleksibel",
    whatYouWillLearn: [
      "Pahami praktik dan proses yang dipakai analis data junior setiap hari",
      "Bersihkan dan olah data, lalu analisis dengan spreadsheet, SQL, dan R",
      "Visualisasikan dan sajikan temuan data lewat dasbor serta presentasi",
    ],
    skills: [
      "Data Cleaning",
      "SQL Querying",
      "R Programming",
      "Tableau Dashboards",
      "Spreadsheet Modeling",
      "Data Ethics",
      "Data Visualization",
    ],
    tools: [
      "SQL",
      "Tableau",
      "RStudio",
      "Google BigQuery",
      "Google Sheets",
      "Kaggle",
    ],
    courses: [
      {
        number: 1,
        title: "Foundations: Data, Data, Everywhere",
        hours: "22 jam",
        rating: 4.8,
        description:
          "Jelaskan konsep kunci dalam ekosistem data, siklus hidup data, dan berpikir analitis.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/60/097644c12e4aeba0c3420de571cac1/GCC-Coursera-thumbnail-DA-foundations-tony-cert-level.png?auto=format%2C%20compress%2C%20enhance&dpr=1&w=320&h=180&fit=crop&q=50&crop=focalpoint&fp-y=0.48",
      },
    ],
  },
  "google-cybersecurity": {
    slug: "google-cybersecurity",
    type: "Professional Certificate",
    title: "Google Cybersecurity Professional Certificate",
    subtitle:
      "Masuk jalur cepat menuju karier keamanan siber. Pelajari keterampilan siap kerja seperti Python, Linux, SQL, alat SIEM, dan sistem deteksi penyusupan.",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Google Career Certificates",
    instructorRole: "Insinyur Operasi Keamanan di Google",
    instructorBio:
      "Dikembangkan oleh pemimpin keamanan siber Google untuk menyiapkan kandidat peran di pusat operasi keamanan.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=75&h=75",
    thumbnail: "/images/programs/google-cybersecurity.jpg",
    rating: 4.8,
    reviews: "45K",
    enrolled: "410,000",
    startDate: "Starts Today",
    category: "Information Technology",
    subcategory: "Security",
    seriesCount: 8,
    level: "Beginner level",
    durationWeeks: 6,
    hoursPerWeek: 10,
    pace: "Jadwal fleksibel",
    whatYouWillLearn: [
      "Pahami dasar keamanan siber dan peran analis keamanan dalam melindungi sistem",
      "Kenali ancaman, risiko, dan kerentanan umum beserta cara mitigasinya",
      "Berikan praktik langsung dengan Python, Linux, dan SQL untuk mengotomatiskan tugas",
    ],
    skills: [
      "Threat Detection",
      "Network Security",
      "Linux CLI",
      "Python Scripting",
      "SIEM Incident Response",
      "Packet Analysis",
    ],
    tools: [
      "Wireshark",
      "Splunk",
      "Chronicle",
      "Linux",
      "Python",
      "SQL",
    ],
    courses: [
      {
        number: 1,
        title: "Foundations of Cybersecurity",
        hours: "14 jam",
        rating: 4.8,
        description:
          "Pelajari prinsip dasar keamanan siber, serangan umum, dan kerangka NIST.",
        thumbnail:
          "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=320&h=180&q=80",
      },
    ],
  },
  "ibm-data-analyst": {
    slug: "ibm-data-analyst",
    type: "Professional Certificate",
    title: "IBM Data Analyst Professional Certificate",
    subtitle:
      "Mulai karier di analitik data bersama IBM. Kuasai Python, SQL, Excel, dan IBM Cognos Analytics untuk menghasilkan intelijen bisnis yang bisa ditindaklanjuti.",
    provider: "IBM",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced241374d08852372f5c71b6980/IBM_logo_blue_100x100.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "IBM Skills Network",
    instructorRole: "Pemimpin Ilmu Data & AI di IBM",
    instructorBio:
      "Pakar IBM mengajarkan alat dan teknik yang benar-benar dipakai industri untuk menganalisis data.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced241374d08852372f5c71b6980/IBM_logo_blue_100x100.png?auto=format%2Ccompress&dpr=3&w=75&h=75",
    thumbnail: "/images/programs/ibm-data-analyst.jpg",
    rating: 4.7,
    reviews: "82K",
    enrolled: "520,000",
    startDate: "Starts Today",
    category: "Data Science",
    subcategory: "Data Analysis",
    seriesCount: 9,
    level: "Beginner level",
    durationWeeks: 5,
    hoursPerWeek: 10,
    pace: "Jadwal fleksibel",
    whatYouWillLearn: [
      "Tunjukkan penguasaan alat analisis data modern seperti Excel, Cognos, dan pustaka Python",
      "Lakukan pembersihan data, pengolahan, query SQL, dan bangun dasbor visualisasi",
      "Selesaikan proyek capstone nyata dengan analitik prediktif dan pemodelan bisnis",
    ],
    skills: [
      "Python Data Analysis",
      "SQL Querying",
      "IBM Cognos",
      "Pandas & NumPy",
      "Data Dashboards",
      "Statistical Analysis",
    ],
    tools: [
      "Python",
      "Jupyter Notebooks",
      "SQL",
      "IBM Cognos",
      "Excel",
      "Matplotlib",
    ],
    courses: [
      {
        number: 1,
        title: "Introduction to Data Analytics",
        hours: "11 jam",
        rating: 4.8,
        description:
          "Pahami ekosistem data dan alur kerja dasar yang dipakai analis profesional.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://d15cw65ipctsrr.cloudfront.net/23/f74c5a9a9c4110b78909194abbdc7a/BC-5768_VisMerch-Phase-3-Assets_ProCerts_IBM_DataAnalyst.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop&q=50",
      },
    ],
  },
  "machine-learning-introduction": {
    slug: "machine-learning-introduction",
    type: "Specialization",
    title: "Machine Learning Specialization",
    subtitle:
      "Masuk ke dunia AI lewat Machine Learning Specialization karya Andrew Ng. Kuasai konsep dasar ML dan terapkan teknik machine learning yang praktis.",
    provider: "DeepLearning.AI & Stanford University",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/9a/c0a6b0143811e7a3ec515d9da6396e/DeepLearning-AI-Logo_Square.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Andrew Ng",
    instructorRole: "Pendiri DeepLearning.AI, Pendiri Bersama Coursera, Profesor Tamu di Stanford",
    instructorBio:
      "Andrew Ng adalah pioneer AI yang telah mengajarkan machine learning kepada lebih dari 7 juta orang.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-instructor-photos.s3.amazonaws.com/26/5d1ff0c20a11e7b26715f2146f88be/AndrewNg.jpg?auto=format%2Ccompress&dpr=1&w=75&h=75&fit=crop",
    thumbnail: "/images/programs/machine-learning-introduction.jpg",
    rating: 4.9,
    reviews: "39K",
    enrolled: "380,000",
    startDate: "Starts Today",
    category: "Data Science",
    subcategory: "Machine Learning",
    seriesCount: 3,
    level: "Beginner level",
    durationWeeks: 3,
    hoursPerWeek: 10,
    pace: "Jadwal fleksibel",
    whatYouWillLearn: [
      "Bangun model ML di Python dengan NumPy dan scikit-learn untuk pembelajaran terawasi maupun tidak terawasi",
      "Bangun dan latih jaringan syaraf tiruan dengan TensorFlow untuk klasifikasi multi-kelas",
      "Terapkan praktik terbaik: feature engineering, pohon keputusan, random forest, dan sistem rekomendasi",
    ],
    skills: [
      "Supervised Learning",
      "Unsupervised Learning",
      "Neural Networks",
      "Decision Trees",
      "Recommender Systems",
      "Model Evaluation",
    ],
    tools: [
      "Python",
      "TensorFlow",
      "NumPy",
      "scikit-learn",
      "Jupyter Notebooks",
    ],
    courses: [
      {
        number: 1,
        title: "Supervised Machine Learning: Regression and Classification",
        hours: "33 jam",
        rating: 4.9,
        description:
          "Pelajari cara membangun model machine learning terawasi dengan Python, NumPy, dan scikit-learn.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/6a/48f4bf23504f7a93b4a2ebfc6d6fb3/MLS_Thumbnail_v2.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop&q=50",
      },
    ],
  },
};

const ACRONYMS: Record<string, string> = {
  ibm: "IBM",
  ai: "AI",
  aws: "AWS",
  it: "IT",
  ux: "UX",
  ui: "UI",
  sql: "SQL",
};

export function getProgramBySlug(slug: string): ProgramDetails {
  return PROGRAMS_REGISTRY[slug] ?? {
    slug,
    type: slug.includes("certificate") ? "Professional Certificate" : "Specialization",
    title: slug
      .split("-")
      .map((w) => ACRONYMS[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" "),
    // Kosakata kredensial ditulis langsung, bukan lewat `format.ts`: modul data
    // tidak boleh mengimpor dari folder komponen, dan `format.ts` sudah
    // mengimpor tipe dari sini — satu arah saja.
    subtitle: `Jelajahi pelatihan menyeluruh dan bangun keterampilan siap industri lewat ${slug.includes("certificate") ? "Sertifikat Profesional" : "Spesialisasi"} terakreditasi ini.`,
    provider: "Mitra Industri Careevo",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Fakultas Careevo & Pemimpin Industri",
    instructorRole: "Spesialis Senior & Praktisi",
    instructorBio:
      "Program Careevo dibangun bersama perusahaan teknologi dan universitas terkemuka.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-instructor-photos.s3.amazonaws.com/0f/8af4a501964eb58b75f4484a0e35b3/AI-AGENTS-24-.jpg?auto=format%2Ccompress&dpr=1&w=75&h=75&fit=crop",
    // Sengaja tanpa `thumbnail`: program sintetis ini dipakai untuk slug yang
    // tidak ada di registry, jadi tidak ada foto yang bisa dikreditkan padanya.
    // Satu gambar di sini membuat setiap slug tak dikenal memakai sampul program
    // yang sama persis; `ProgramCard` lalu jatuh ke nama penyedia, yang jujur.
    thumbnail: undefined,
    rating: 4.8,
    reviews: "50K",
    enrolled: "350,000",
    startDate: "Starts Today",
    category: "Professional Development",
    subcategory: "Applied Learning",
    seriesCount: 4,
    level: "Beginner level",
    durationWeeks: 4,
    hoursPerWeek: 10,
    pace: "Jadwal fleksibel",
    whatYouWillLearn: [
      "Kuasai alur kerja dan kerangka dasar standar industri",
      "Selesaikan tugas praktik yang dinilai dengan atestasi HMAC yang dapat diverifikasi",
      "Bangun proyek siap portofolio yang menunjukkan kesiapan kerja",
    ],
    skills: ["Applied Problem Solving", "Workflow Automation", "Industry Best Practices"],
    tools: ["Careevo Platform", "Toolchain Pengembangan Modern"],
    courses: [
      {
        number: 1,
        title: "Pengenalan & Dasar-Dasar",
        hours: "12 jam",
        rating: 4.8,
        description: "Konsep inti dan persiapan.",
        thumbnail:
          "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=320&h=180&q=80",
      },
    ],
  };
}
