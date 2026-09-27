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
      "Master Claude for Work and Apps. Automate workflows, build apps, and create personal AI agents with Claude",
    provider: "Digital & AI Academy",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/eb/462677a34a4d8bb160038d2a8fe758/Untitled-design-6-.png?auto=format%2Ccompress&dpr=1&h=45",
    instructor: "Dr. Ryan Ahmed",
    instructorRole: "AI Expert, Best-Selling Instructor & Tech Educator",
    instructorBio:
      "Dr. Ryan Ahmed is an AI researcher, university professor, and entrepreneur with over 500,000 students worldwide. He specializes in practical AI application, helping software developers and knowledge workers scale productivity through LLMs, autonomous coding, and intelligent workflow pipelines.",
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
    pace: "Flexible schedule • Learn at your own pace",
    whatYouWillLearn: [
      "Use Claude Chat, Cowork, skills, plugins, and MCP connectors to automate professional workflows",
      "Apply Claude in Excel and PowerPoint to clean data, analyze results, visualize insights, and create presentations",
      "Build apps, AI agents, and personal agent automations with Claude Code and structured agent architectures",
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
        hours: "4 hours",
        rating: 4.9,
        description:
          "Learn how to set up Claude Cowork, configure custom skills, connect external APIs via Model Context Protocol (MCP), and build automated daily execution pipelines.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/a8/adfce2daba479f9899859f4a69f438/3.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 2,
        title: "Claude Chat Mastery",
        hours: "2 hours",
        rating: 4.8,
        description:
          "Master advanced prompt engineering techniques, artifact generation, system instructions, and multi-turn persona steering for business tasks.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/ca/c14c8d469c439cacf99a3019a4f5f9/1.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 3,
        title: "AI-Powered Productivity: Claude in MS Office",
        hours: "4 hours",
        rating: 4.8,
        description:
          "Harness Claude inside Excel for dynamic modeling and complex formulas, and PowerPoint for automated presentation storytelling and asset drafting.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/f9/0408191c0c4e41807b32756176d46e/4.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 4,
        title: "Building Apps and AI Agents with Claude Code",
        hours: "9 hours",
        rating: 4.9,
        description:
          "Deep dive into terminal-driven AI engineering with Claude Code CLI. Scaffold full-stack web applications, write tests, and orchestrate subagent architectures.",
        thumbnail:
          "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://s3.amazonaws.com/coursera-course-photos/c4/8139acf9b542419e9b6c739c58e340/2.png?auto=format%2Ccompress&dpr=1&w=320&h=180&fit=crop",
      },
      {
        number: 5,
        title: "Capstone Course: Build Your Personal Agent",
        hours: "9 hours",
        rating: 4.9,
        description:
          "Synthesize all skills by creating an end-to-end autonomous agent workflow with persistent memory, tool-calling capabilities, and verified evaluation checks.",
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
      "Get on the fast track to a career in project management. Learn in-demand skills, and get AI training from Google experts. Learn at your own pace with no degree required.",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Google Career Certificates",
    instructorRole: "Industry Experts & Technical Leads at Google",
    instructorBio:
      "Google Career Certificates are designed to prepare job seekers for entry-level careers in high-growth fields with no experience required.",
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
    pace: "Flexible schedule • Learn at your own pace",
    whatYouWillLearn: [
      "Gain an immersive understanding of the practices and fundamental skills needed for an entry-level project management role",
      "Learn how to create effective project documentation, risk management artifacts, and milestone plans",
      "Master Agile and Scrum frameworks, running sprint ceremonies, estimating velocity, and managing backlogs",
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
        hours: "18 hours",
        rating: 4.9,
        description:
          "Explore the fundamentals of project management and the roles, responsibilities, and career paths available.",
        thumbnail:
          "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=320&h=180&q=80",
      },
      {
        number: 2,
        title: "Project Initiation: Starting a Successful Project",
        hours: "22 hours",
        rating: 4.8,
        description:
          "Define project goals, determine deliverables, calculate ROI, and complete a detailed project charter.",
        thumbnail:
          "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=320&h=180&q=80",
      },
      {
        number: 3,
        title: "Project Planning: Putting It All Together",
        hours: "24 hours",
        rating: 4.8,
        description:
          "Build project schedules, identify milestones, map critical paths, and draft risk management registers.",
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
      "Get on the fast track to a career in data analytics. Gain in-demand skills and hands-on experience using spreadsheets, SQL, Tableau, and R from Google experts.",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Google Career Certificates",
    instructorRole: "Data Analysts & Engineers at Google",
    instructorBio:
      "Created by Google data analysts, this program gives learners practical skills needed to collect, transform, clean, and visualize data for decision making.",
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
    pace: "Flexible schedule • Learn at your own pace",
    whatYouWillLearn: [
      "Gain an immersive understanding of the practices and processes used by a junior or associate data analyst in their day-to-day job",
      "Learn how to clean and organize data for analysis, and complete analysis and calculations using spreadsheets, SQL and R programming",
      "Learn how to visualize and present data findings in dashboards, presentations and commonly used visualization platforms",
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
        hours: "22 hours",
        rating: 4.8,
        description:
          "Define and explain key concepts in the data ecosystem, data lifecycles, and analytical thinking.",
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
      "Get on the fast track to a career in cybersecurity. Learn job-ready skills including Python, Linux, SQL, SIEM tools, and intrusion detection systems.",
    provider: "Google",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Google Career Certificates",
    instructorRole: "Security Operations Engineers at Google",
    instructorBio:
      "Developed by Google's cybersecurity leaders to prepare candidates for roles in security operations centers (SOC) and threat defense.",
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
    pace: "Flexible schedule • Learn at your own pace",
    whatYouWillLearn: [
      "Understand cybersecurity fundamentals and the role of a security analyst in protecting systems and networks",
      "Identify common threats, risks, vulnerabilities, and techniques to mitigate security breaches",
      "Gain hands-on experience with Python, Linux, and SQL to automate tasks and investigate security incidents",
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
        hours: "14 hours",
        rating: 4.8,
        description:
          "Learn the foundational principles of cybersecurity, common attacks, and the NIST framework.",
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
      "Launch your career in data analytics with IBM. Master Python, SQL, Excel, and IBM Cognos Analytics to extract actionable business intelligence.",
    provider: "IBM",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/bb/f5ced241374d08852372f5c71b6980/IBM_logo_blue_100x100.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "IBM Skills Network",
    instructorRole: "Data Science & AI Leaders at IBM",
    instructorBio:
      "IBM experts teach the actual tools and techniques used in industry to analyze data, build predictive pipelines, and present results.",
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
    pace: "Flexible schedule • Learn at your own pace",
    whatYouWillLearn: [
      "Demonstrate proficiency in modern data analysis tools including Excel, Cognos Analytics, and Python libraries",
      "Perform data cleaning, wrangling, querying with SQL, and building dynamic data visualization dashboards",
      "Complete a real-world capstone project applying predictive analytics and business modeling",
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
        hours: "11 hours",
        rating: 4.8,
        description:
          "Understand the data ecosystem and the fundamental workflows used by professional analysts.",
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
      "Break into AI with the legendary Machine Learning Specialization created by Andrew Ng. Master foundational ML concepts and apply practical machine learning techniques.",
    provider: "DeepLearning.AI & Stanford University",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/9a/c0a6b0143811e7a3ec515d9da6396e/DeepLearning-AI-Logo_Square.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Andrew Ng",
    instructorRole: "Founder of DeepLearning.AI, Co-founder of Coursera, Adjunct Professor at Stanford",
    instructorBio:
      "Andrew Ng is an AI pioneer who has taught machine learning to over 7 million people worldwide. He leads DeepLearning.AI and AI Fund.",
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
    pace: "Flexible schedule • Learn at your own pace",
    whatYouWillLearn: [
      "Build ML models in Python using NumPy and scikit-learn for supervised and unsupervised learning",
      "Build and train neural networks with TensorFlow to perform multi-class classification and deep learning tasks",
      "Apply best practices for ML development, feature engineering, decision trees, random forests, and recommender systems",
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
        hours: "33 hours",
        rating: 4.9,
        description:
          "Learn how to build supervised machine learning models with Python, NumPy, and scikit-learn.",
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
    subtitle: `Explore comprehensive training and build practical industry-ready skills with this accredited ${slug.includes("certificate") ? "Professional Certificate" : "Specialization"}.`,
    provider: "Careevo Industry Partners",
    providerLogo:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/http://coursera-university-assets.s3.amazonaws.com/92/d0d1ee4a844037be9a2d349ee5f59d/GoogleG_FullColor_RGB.png?auto=format%2Ccompress&dpr=3&w=40&h=40",
    instructor: "Careevo Faculty & Industry Leads",
    instructorRole: "Senior Specialists & Practitioners",
    instructorBio:
      "Careevo programs are built in collaboration with leading technology companies and universities to deliver verified hands-on skills.",
    instructorAvatar:
      "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-instructor-photos.s3.amazonaws.com/0f/8af4a501964eb58b75f4484a0e35b3/AI-AGENTS-24-.jpg?auto=format%2Ccompress&dpr=1&w=75&h=75&fit=crop",
    thumbnail: "/images/programs/google-data-analytics.jpg",
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
    pace: "Flexible schedule",
    whatYouWillLearn: [
      "Master industry standard workflows, patterns, and foundational frameworks",
      "Complete hands-on assignments evaluated with verifiable HMAC attestations",
      "Build portfolio-ready projects demonstrating job readiness",
    ],
    skills: ["Applied Problem Solving", "Workflow Automation", "Industry Best Practices"],
    tools: ["Careevo Platform", "Modern Development Toolchain"],
    courses: [
      {
        number: 1,
        title: "Introduction & Foundations",
        hours: "12 hours",
        rating: 4.8,
        description: "Core concepts and setup.",
        thumbnail:
          "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=320&h=180&q=80",
      },
    ],
  };
}
