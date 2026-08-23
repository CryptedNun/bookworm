export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio: string;
  role: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  joinedDate: string;
  capabilities: {
    canCreateIssue: boolean;
    canDeleteBranch: boolean;
    canMergeBranch: boolean;
    canAddContributor: boolean;
  };
  stats: {
    notebooksCount: number;
    notesCount: number;
    contributedCount: number;
    issuesCount: number;
    commitsCount: number;
  };
}

export interface NoteItem {
  id: string;
  notebookId: string;
  title: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  role: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  defaultEdition: string;
  lastUpdated: string;
  blocksCount: number;
  branchesCount: number;
  openIssuesCount: number;
  isStarred?: boolean;
  forkedFrom?: string;
}

export interface NotebookItem {
  id: string;
  title: string;
  description: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  role: 'OWNER' | 'MAINTAINER' | 'CONTRIBUTOR';
  notesCount: number;
  lastUpdated: string;
  isStarred?: boolean;
  notes: NoteItem[];
}

export interface IssueItem {
  id: string;
  noteTitle: string;
  noteId: string;
  slotId: string;
  targetBlock: string;
  title: string;
  creator: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'MERGED' | 'CLOSED';
  branchName: string;
  createdAt: string;
  assignedTo: string[];
}

export interface BranchItem {
  id: string;
  noteTitle: string;
  noteId: string;
  branchName: string;
  isMain: boolean;
  isMerged: boolean;
  commitsCount: number;
  lastCommitMessage: string;
  author: string;
}

export interface NotificationItem {
  id: string;
  type: 'ACCESS_REQUEST' | 'ISSUE_ASSIGNED' | 'BRANCH_MERGED' | 'EDITION_PUBLISHED';
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
}

export const currentUser: User = {
  id: 'usr-alice-101',
  name: 'Alice Walker',
  username: 'alice',
  email: 'alice@bookworm.dev',
  avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  bio: 'Software engineer & technical writer. Exploring distributed note systems & LexoRank indexing.',
  role: 'OWNER',
  joinedDate: 'January 2026',
  capabilities: {
    canCreateIssue: true,
    canDeleteBranch: true,
    canMergeBranch: true,
    canAddContributor: true,
  },
  stats: {
    notebooksCount: 4,
    notesCount: 12,
    contributedCount: 5,
    issuesCount: 3,
    commitsCount: 84,
  },
};

export const sampleNotebooks: NotebookItem[] = [
  {
    id: 'nb-cs101',
    title: 'CS 101 Study Notes',
    description: 'Collaborative computer science fundamentals, algorithms, and data structures.',
    visibility: 'PUBLIC',
    role: 'OWNER',
    notesCount: 4,
    lastUpdated: '10m ago',
    isStarred: true,
    notes: [
      {
        id: 'note-trees',
        notebookId: 'nb-cs101',
        title: 'B-Trees and AVL Self-Balancing Trees',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v2.1 Final',
        lastUpdated: '10m ago',
        blocksCount: 48,
        branchesCount: 2,
        openIssuesCount: 1,
        isStarred: true,
      },
      {
        id: 'note-graphs',
        notebookId: 'nb-cs101',
        title: 'Graph Algorithms & Dijkstra Shortest Path',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v1.0 Stable',
        lastUpdated: '2h ago',
        blocksCount: 62,
        branchesCount: 1,
        openIssuesCount: 0,
      },
      {
        id: 'note-dp',
        notebookId: 'nb-cs101',
        title: 'Dynamic Programming & Memoization Patterns',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'Draft',
        lastUpdated: '1d ago',
        blocksCount: 34,
        branchesCount: 3,
        openIssuesCount: 2,
      },
    ],
  },
  {
    id: 'nb-web-arch',
    title: 'Modern Web Architecture',
    description: 'Next.js App Router, Server Components, and Database Optimization guides.',
    visibility: 'PUBLIC',
    role: 'OWNER',
    notesCount: 3,
    lastUpdated: '3h ago',
    isStarred: true,
    notes: [
      {
        id: 'note-next-rsc',
        notebookId: 'nb-web-arch',
        title: 'React 19 & Next.js Server Components In-Depth',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v3.0 Release',
        lastUpdated: '3h ago',
        blocksCount: 85,
        branchesCount: 2,
        openIssuesCount: 0,
        isStarred: true,
      },
      {
        id: 'note-lexorank',
        notebookId: 'nb-web-arch',
        title: 'LexoRank 3-Layer Block Storage Architecture',
        visibility: 'PUBLIC',
        role: 'OWNER',
        defaultEdition: 'v2.0 Pinned',
        lastUpdated: '5h ago',
        blocksCount: 110,
        branchesCount: 4,
        openIssuesCount: 1,
      },
    ],
  },
  {
    id: 'nb-db-design',
    title: 'Distributed Databases & Storage',
    description: 'Content-addressable storage (SHA-256), manifests, and deduplication models.',
    visibility: 'PRIVATE',
    role: 'OWNER',
    notesCount: 2,
    lastUpdated: '2d ago',
    notes: [
      {
        id: 'note-cas',
        notebookId: 'nb-db-design',
        title: 'Content-Addressed Blobs & Zero-Cost Forking',
        visibility: 'PRIVATE',
        role: 'OWNER',
        defaultEdition: 'Draft v1',
        lastUpdated: '2d ago',
        blocksCount: 42,
        branchesCount: 1,
        openIssuesCount: 0,
      },
    ],
  },
  {
    id: 'nb-research',
    title: 'Personal Research & Ideas',
    description: 'Draft ideas for decentralized knowledge graphs.',
    visibility: 'PRIVATE',
    role: 'OWNER',
    notesCount: 1,
    lastUpdated: '5d ago',
    notes: [
      {
        id: 'note-graphs-kg',
        notebookId: 'nb-research',
        title: 'Knowledge Graph Synapses',
        visibility: 'PRIVATE',
        role: 'OWNER',
        defaultEdition: 'v0.1',
        lastUpdated: '5d ago',
        blocksCount: 18,
        branchesCount: 1,
        openIssuesCount: 0,
      },
    ],
  },
];

export const sampleContributedNotes: NoteItem[] = [
  {
    id: 'note-os-internals',
    notebookId: 'nb-kernel-group',
    title: 'Linux Kernel Memory Management & Paging',
    description: 'Owned by @torvalds-club. Collaborative deep dive into Linux virtual memory.',
    visibility: 'PUBLIC',
    role: 'MAINTAINER',
    defaultEdition: 'v5.18 Stable',
    lastUpdated: '1h ago',
    blocksCount: 154,
    branchesCount: 5,
    openIssuesCount: 3,
    isStarred: true,
  },
  {
    id: 'note-postgres-tuning',
    notebookId: 'nb-db-perf',
    title: 'PostgreSQL Query Planner & Indexing Tactics',
    description: 'Owned by @db-guild. Production indexing patterns and VACUUM internals.',
    visibility: 'PUBLIC',
    role: 'CONTRIBUTOR',
    defaultEdition: 'v1.4',
    lastUpdated: '4h ago',
    blocksCount: 76,
    branchesCount: 2,
    openIssuesCount: 1,
  },
  {
    id: 'note-rust-async',
    notebookId: 'nb-rustaceans',
    title: 'Async Rust with Tokio: Concurrency Patterns',
    description: 'Owned by @rust-study. Pin, Futures, and Waker deep dive.',
    visibility: 'PUBLIC',
    role: 'CONTRIBUTOR',
    defaultEdition: 'v2.0 Draft',
    lastUpdated: '1d ago',
    blocksCount: 92,
    branchesCount: 3,
    openIssuesCount: 2,
  },
];

export const sampleIssues: IssueItem[] = [
  {
    id: 'iss-14',
    noteTitle: 'B-Trees and AVL Self-Balancing Trees',
    noteId: 'note-trees',
    slotId: 'slot-avl-rotations-42',
    targetBlock: 'Paragraph #42: AVL Right-Left Rotation explanation',
    title: 'Fix typo in AVL double rotation mathematical proof',
    creator: 'bob',
    status: 'IN_PROGRESS',
    branchName: 'issue-14-avl-rotation-proof',
    createdAt: '2 hours ago',
    assignedTo: ['alice', 'bob'],
  },
  {
    id: 'iss-21',
    noteTitle: 'LexoRank 3-Layer Block Storage Architecture',
    noteId: 'note-lexorank',
    slotId: 'slot-lexorank-midpoint-12',
    targetBlock: 'Code Block #12: Midpoint calculation algorithm',
    title: 'Add TypeScript LexoRank midpoint generation example',
    creator: 'charlie',
    status: 'OPEN',
    branchName: 'issue-21-lexorank-ts-code',
    createdAt: '5 hours ago',
    assignedTo: ['alice'],
  },
  {
    id: 'iss-28',
    noteTitle: 'Linux Kernel Memory Management & Paging',
    noteId: 'note-os-internals',
    slotId: 'slot-hugepages-88',
    targetBlock: 'Heading #88: Transparent Huge Pages (THP)',
    title: 'Update kernel 6.x hugepage fragmentation metrics',
    creator: 'dave',
    status: 'OPEN',
    branchName: 'issue-28-thp-metrics',
    createdAt: '1 day ago',
    assignedTo: ['alice'],
  },
];

export const sampleNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'ACCESS_REQUEST',
    title: 'Access Request from @bob',
    description: 'Bob requested Contributor role on "CS 101 Study Notes"',
    timestamp: '15m ago',
    unread: true,
  },
  {
    id: 'notif-2',
    type: 'ISSUE_ASSIGNED',
    title: 'Assigned to Issue #21',
    description: 'Charlie assigned you to "Add TypeScript LexoRank midpoint code"',
    timestamp: '2h ago',
    unread: true,
  },
  {
    id: 'notif-3',
    type: 'BRANCH_MERGED',
    title: 'Branch Merged into main',
    description: 'Branch "issue-12-dijkstra-proof" was merged by @alice into main',
    timestamp: '1d ago',
    unread: false,
  },
  {
    id: 'notif-4',
    type: 'EDITION_PUBLISHED',
    title: 'New Edition Published',
    description: 'Edition "v3.0 Release" of React 19 Server Components is now live',
    timestamp: '2d ago',
    unread: false,
  },
];
