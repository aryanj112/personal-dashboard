export enum NetworkingRole {
  SoftwareEngineer = "Software Engineer",
  FrontendEngineer = "Frontend Engineer",
  BackendEngineer = "Backend Engineer",
  FullStackEngineer = "Full Stack Engineer",
  EmbeddedEngineer = "Embedded Engineer",
  MLEngineer = "ML Engineer",
  DataEngineer = "Data Engineer",
  ProductManager = "Product Manager",
  FoundingEngineer = "Founding Engineer",
  EngineeringManager = "Engineering Manager",
  ResearchEngineer = "Research Engineer",
  SecurityEngineer = "Security Engineer",
  DevOpsEngineer = "DevOps Engineer",
  Designer = "Designer",
  Intern = "Intern",
  Founder = "Founder",
  Recruiter = "Recruiter",
  Professor = "Professor",
  Other = "Other",
}

export enum FollowUpType {
  SendMessage = "Send Message",
  Reply = "Reply",
  ScheduleCoffeeChat = "Schedule Coffee Chat",
  ThankYouNote = "Thank You Note",
  CheckIn = "Check In",
  IntroRequest = "Intro Request",
  FollowUpAfterEvent = "Follow Up After Event",
  Other = "Other",
}

export enum InteractionType {
  CoffeeChat = "Coffee Chat",
  Message = "Message",
  Email = "Email",
  Event = "Event",
  Call = "Call",
  Intro = "Intro",
  LinkedIn = "LinkedIn",
  Other = "Other",
}

export type NetworkingRoleValue = NetworkingRole | string;
export type FollowUpTypeValue = FollowUpType | string;
export type InteractionTypeValue = InteractionType | string;
export interface NetworkingLocation {
  city: string;
  region: string;
}
export type NetworkingSortKey =
  | "attention"
  | "name"
  | "company"
  | "last_contact"
  | "follow_up";

export interface NetworkingInteraction {
  id: number;
  date: string;
  type: InteractionTypeValue;
  summary: string;
}

export interface NetworkingContact {
  id: number;
  name: string;
  company: string;
  role: NetworkingRoleValue;
  tags: string[];
  email: string;
  phone: string;
  linkedin: string;
  location: NetworkingLocation;
  notes: string;
  lastContactDate: string;
  nextFollowUpDate: string;
  howWeMet: string;
  nextAction: string;
  followUpType: FollowUpTypeValue | "";
  isOverdue: boolean;
  interactions: NetworkingInteraction[];
  createdAt: string;
  updatedAt: string;
}

export type PotentialConnectStatus = "pending" | "sent" | "replied" | "converted_to_network";

export interface PotentialConnect {
  id: number;
  name: string;
  company: string;
  role: string;
  linkedin: string;
  focusArea: string;
  connectionRequest: string;
  outreachType: string;
  status: PotentialConnectStatus;
  dateAdded: string;
  dateSent: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type NetworkingOptionConfig = {
  roleOptions: string[];
  tagOptions: string[];
  followUpOptions: string[];
  interactionTypeOptions: string[];
  locationOptions: Record<string, string[]>;
};

export const DEFAULT_NETWORKING_OPTIONS: NetworkingOptionConfig = {
  roleOptions: Object.values(NetworkingRole),
  tagOptions: [
    "Alumni",
    "Worked Together",
    "Friend",
    "Mentor",
    "AKPSI",
    "Recruiter",
    "Founder",
    "Professor",
    "High priority",
    "Referral potential",
    "Strong relationship",
  ],
  followUpOptions: Object.values(FollowUpType),
  interactionTypeOptions: Object.values(InteractionType),
  locationOptions: {
    California: [
      "San Francisco",
      "Palo Alto",
      "Mountain View",
      "Menlo Park",
      "San Jose",
      "Sunnyvale",
      "Santa Clara",
      "Berkeley",
      "Oakland",
      "Los Angeles",
      "Santa Monica",
      "Irvine",
      "San Diego",
    ],
    "New York": ["New York City", "Brooklyn"],
    Washington: ["Seattle", "Bellevue", "Redmond"],
    Texas: ["Austin"],
    Massachusetts: ["Boston", "Cambridge"],
  },
};

export const NETWORKING_COMPANY_FILTER_ALL = "All companies";
export const NETWORKING_LOCATION_FILTER_ALL = "All locations";
export const NETWORKING_ROLE_FILTER_ALL = "All roles";

const MOCK_CONTACTS: NetworkingContact[] = [];

export function getMockNetworkingContacts(referenceDate = new Date()): NetworkingContact[] {
  return MOCK_CONTACTS.map((contact) => ({
    ...contact,
    isOverdue:
      contact.nextFollowUpDate.length > 0 &&
      new Date(`${contact.nextFollowUpDate}T12:00:00`) < referenceDate,
  }));
}

export function getNetworkingCompanies(contacts: NetworkingContact[]): string[] {
  return [
    NETWORKING_COMPANY_FILTER_ALL,
    ...Array.from(new Set(contacts.map((contact) => contact.company))).sort(),
  ];
}

export function getNetworkingRoles(contacts: NetworkingContact[]): string[] {
  return [
    NETWORKING_ROLE_FILTER_ALL,
    ...Array.from(new Set(contacts.map((contact) => contact.role))).sort(),
  ];
}

export function formatNetworkingLocation(location: NetworkingLocation): string {
  return [location.city, location.region].filter(Boolean).join(", ");
}

export function getNetworkingLocations(contacts: NetworkingContact[]): string[] {
  return [
    NETWORKING_LOCATION_FILTER_ALL,
    ...Array.from(
      new Set(
        contacts
          .map((contact) => formatNetworkingLocation(contact.location))
          .filter((value) => value.length > 0),
      ),
    ).sort(),
  ];
}

export function getNetworkingRegions(locationOptions: Record<string, string[]>): string[] {
  return Object.keys(locationOptions);
}

export function getNetworkingCities(region: string, locationOptions: Record<string, string[]>): string[] {
  return locationOptions[region] ?? [];
}

export function getDaysSince(date: string, referenceDate = new Date()): number {
  const reference = new Date(referenceDate.toDateString()).getTime();
  const target = new Date(`${date}T12:00:00`).getTime();
  return Math.max(0, Math.floor((reference - target) / (1000 * 60 * 60 * 24)));
}

export function getDaysUntil(date: string, referenceDate = new Date()): number {
  const reference = new Date(referenceDate.toDateString()).getTime();
  const target = new Date(`${date}T12:00:00`).getTime();
  return Math.ceil((target - reference) / (1000 * 60 * 60 * 24));
}

export function sortNetworkingContacts(
  contacts: NetworkingContact[],
  sortKey: NetworkingSortKey,
  referenceDate = new Date(),
): NetworkingContact[] {
  const hasHighPriorityTag = (contact: NetworkingContact) =>
    contact.tags.some((tag) => tag.toLowerCase() === "high priority");

  return [...contacts].sort((left, right) => {
    if (sortKey === "name") {
      return left.name.localeCompare(right.name);
    }

    if (sortKey === "company") {
      return left.company.localeCompare(right.company) || left.name.localeCompare(right.name);
    }

    if (sortKey === "last_contact") {
      // Most recently contacted first (descending)
      return (
        new Date(`${right.lastContactDate}T12:00:00`).getTime() -
        new Date(`${left.lastContactDate}T12:00:00`).getTime()
      );
    }

    if (sortKey === "follow_up") {
      // Closest scheduled follow-up first; contacts with no follow-up go last
      const leftHas = Boolean(left.nextFollowUpDate);
      const rightHas = Boolean(right.nextFollowUpDate);
      if (leftHas && rightHas) {
        return (
          new Date(`${left.nextFollowUpDate}T12:00:00`).getTime() -
          new Date(`${right.nextFollowUpDate}T12:00:00`).getTime()
        );
      }
      if (leftHas) return -1;
      if (rightHas) return 1;
      return left.name.localeCompare(right.name);
    }

    if (left.isOverdue !== right.isOverdue) {
      return Number(right.isOverdue) - Number(left.isOverdue);
    }

    if (hasHighPriorityTag(left) !== hasHighPriorityTag(right)) {
      return Number(hasHighPriorityTag(right)) - Number(hasHighPriorityTag(left));
    }

    const leftDays = getDaysSince(left.lastContactDate, referenceDate);
    const rightDays = getDaysSince(right.lastContactDate, referenceDate);
    if (leftDays !== rightDays) {
      return rightDays - leftDays;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getOverdueNetworkingContacts(
  contacts: NetworkingContact[],
  referenceDate = new Date(),
): NetworkingContact[] {
  return sortNetworkingContacts(
    contacts.filter((contact) => contact.isOverdue),
    "attention",
    referenceDate,
  );
}
