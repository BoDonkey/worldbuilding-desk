/*
 * In-app help (Slice 5.8). Plain author-facing text, one entry per topic.
 * `**Label**` marks an on-screen name and renders bold. Every statement here
 * must match what the app does today; when a workflow changes, update its
 * topic in the same change.
 */

export type HelpBlock =
  | {kind: 'paragraph'; text: string}
  | {kind: 'list'; items: string[]}
  | {kind: 'steps'; items: string[]};

export interface HelpTopic {
  id: string;
  title: string;
  /** One line shown in the topic list. */
  summary: string;
  /** Words that should find this topic in the help filter. */
  keywords: string[];
  blocks: HelpBlock[];
  /** Screens this topic is about. */
  links: Array<{label: string; to: string}>;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'Create a project and start writing.',
    keywords: ['new', 'project', 'sample', 'scene', 'palette', 'shortcut', 'start'],
    blocks: [
      {
        kind: 'steps',
        items: [
          'Open **Projects** and fill in **Create New Project**. Choose **General Fiction** for a story without game systems, or **LitRPG** for stat blocks and system notifications. You can change this later in **Settings → Project Mode**.',
          'Open the project. It goes straight to **Workspace**, where you write. Use **+ New Scene** in the scenes drawer to add scenes. Your writing saves automatically.',
          'Keep writing. SagaSpine notices names and places as you go and suggests them for your World Bible, without interrupting you.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'To look around first, choose **Explore a sample project** on the Projects page. It is a complete small story you can change or delete.'
      },
      {
        kind: 'paragraph',
        text: 'Press **Cmd+K** (macOS) or **Ctrl+K** (Windows and Linux) anywhere to open the command palette and jump to any screen. Screens not shown in the side rail are under **More**.'
      }
    ],
    links: [
      {label: 'Projects', to: '/projects'},
      {label: 'Workspace', to: '/workspace'}
    ]
  },
  {
    id: 'canon-model',
    title: 'World Bible, Source Notes, and canon',
    summary: 'Where your story facts live, and what counts as canon.',
    keywords: ['world bible', 'source notes', 'lore', 'canon', 'facts', 'records', 'categories', 'alias', 'corkboard', 'world canvas'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'SagaSpine keeps a clear line between what is true in your story (canon) and material you are still working from.'
      },
      {
        kind: 'list',
        items: [
          '**World Bible** is the home of canon: characters, places, items, factions, and any categories you add. Each record has fields, aliases (other names it goes by), and accepted facts. Use **Manage Categories** to add categories or fields.',
          '**Source Notes** hold reference material: research, outlines, old drafts, imported documents. A Source Note is never canon by itself. **Extract Candidates** pulls possible records and facts out of a saved note for you to review.',
          '**Corkboard** and **World Canvas** are for planning and brainstorming. Nothing there becomes canon unless you add it to the World Bible.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'A fact becomes canon only when you accept it. The assistant, imports, and extraction can suggest records and facts, but they wait for your decision.'
      }
    ],
    links: [
      {label: 'World Bible', to: '/world-bible'},
      {label: 'Source Notes', to: '/lore'}
    ]
  },
  {
    id: 'review',
    title: 'Reviewing suggestions',
    summary: 'Underlined names, the Review drawer, and Canon Review.',
    keywords: ['review', 'underline', 'highlight', 'ignore', 'always ignore', 'add to world', 'canon review', 'conflict', 'duplicate', 'extraction'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Suggestions never block writing. You can deal with them whenever you like, or not at all.'
      },
      {
        kind: 'list',
        items: [
          '**In the editor:** a name SagaSpine doesn’t know yet is underlined. Click it to add it to the World Bible (**Add to World**, or **Create record** in LitRPG projects), **Ignore** it for now, or **Always ignore** it in this project. Names already in your World Bible are highlighted too; click one to see its record.',
          '**From a selection:** select any text and choose **Add to World** to create a record or link the text to an existing one.',
          '**The Review drawer:** the review badge in the Workspace header opens a list of everything waiting, split into **Current document** and **Other documents**. Choosing an item jumps to it in the scene.',
          '**Source Note extraction:** after **Extract Candidates**, the **Extraction Review** lists possible records and facts. Accept the ones you want; nothing else changes.',
          '**Canon Review** (under **More**) collects likely duplicates and conflicting facts. For each one, choose **Accept New**, **Alias To Existing** (it’s another name for a record you have), **Keep Separate**, **Reject**, or **Defer**.'
        ]
      }
    ],
    links: [
      {label: 'Workspace', to: '/workspace'},
      {label: 'Canon Review', to: '/canon-decisions'}
    ]
  },
  {
    id: 'importing',
    title: 'Importing your writing',
    summary: 'Bring in scenes, World Bible documents, and notes.',
    keywords: ['import', 'docx', 'word', 'markdown', 'pages', 'obsidian', 'folder', 'strict', 'balanced', 'lenient', 'dossier'],
    blocks: [
      {
        kind: 'list',
        items: [
          '**Scenes:** in Workspace, open the scenes drawer and choose **Import**. Plain text, Markdown, HTML, and Word (.docx) files work, and Pages files usually do (if one doesn’t, export it from Pages as Word). Old Word .doc files don’t. Each file becomes a scene.',
          '**Import mode** sets how imported scenes are checked: **Strict** flags unknown names as issues, **Balanced** shows them as softer warnings, and **Lenient** skips the check. **Skip consistency suggestions for this import** does the same for one batch. Set the defaults in **Settings → Workspace Import Defaults**.',
          '**World Bible documents:** in World Bible, import a Markdown or Word document about a character or place. You choose where each heading goes before anything is saved, and drafts are saved only when you choose **Import selected**.',
          '**Source Notes:** use **Import File** or **Import Dossier** on the Source Notes screen.',
          '**A folder of Markdown notes** (from Obsidian, for example): use **Portable data → Import Markdown Folder**. You decide, file by file, what becomes a Source Note or a World Bible draft.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'Imported scenes are saved first and reviewed afterwards, so review never holds up an import. **Retry failed files only** tries again just the files that didn’t import.'
      }
    ],
    links: [
      {label: 'Workspace', to: '/workspace'},
      {label: 'World Bible', to: '/world-bible'},
      {label: 'Portable data', to: '/portable-data'}
    ]
  },
  {
    id: 'backup-export',
    title: 'Backups and exports',
    summary: 'Keep a full copy of a project, or take your work elsewhere.',
    keywords: ['backup', 'export', 'restore', 'zip', 'sagabackup', 'docx', 'epub', 'markdown', 'csv', 'portable', 'encrypted'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'Every project can leave SagaSpine in full, and in formats other tools can read.'
      },
      {
        kind: 'list',
        items: [
          '**Full backup:** on the Projects page, choose **Export Backup** on a project. A **Plain backup (.zip)** can be read by anyone who has the file. An **Encrypted backup (.sagabackup)** needs its passphrase to open; SagaSpine never stores that passphrase and cannot recover it.',
          '**Restore:** open **Backup and import tools** on the Projects page. **Import Backup** shows a preview, then creates a new project or merges into an existing one. **Validate Backup** checks a file without importing it.',
          '**Your manuscript:** in Workspace, the scenes drawer has **Export MD**, **Export DOCX**, and **Export EPUB**.',
          '**World Bible and Source Notes as plain files:** **Portable data → Export Markdown + CSV** makes a ZIP with one Markdown file per record and per Source Note, and one spreadsheet per category. It isn’t a backup and can’t restore a project.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'Make a backup before big changes, and keep copies somewhere other than this computer.'
      }
    ],
    links: [
      {label: 'Projects', to: '/projects'},
      {label: 'Portable data', to: '/portable-data'}
    ]
  },
  {
    id: 'ai-setup',
    title: 'Setting up AI',
    summary: 'Connect a hosted provider or a model on your computer.',
    keywords: ['ai', 'assistant', 'api key', 'claude', 'anthropic', 'openai', 'gemini', 'ollama', 'lm studio', 'koboldcpp', 'llama.cpp', 'local', 'budget', 'consultations', 'test connection', 'ask'],
    blocks: [
      {
        kind: 'paragraph',
        text: 'AI is optional. Writing, the World Bible, review, and backups all work without it.'
      },
      {
        kind: 'steps',
        items: [
          'Open **Settings → AI Settings** and choose a **Provider**: Anthropic (Claude), OpenAI, or Gemini with your own API key, or a model on your computer through **Ollama** or a local model server (LM Studio, KoboldCPP, llama.cpp).',
          'For a hosted provider, paste your API key and save it. Saved keys are encrypted by your operating system and never shown again.',
          'Choose **Test connection** to check that it works.'
        ]
      },
      {
        kind: 'list',
        items: [
          '**Daily budget:** hosted requests count against **Max consultations per day**, a per-project limit that stops runaway use. When you reach it, you can add more for today right where you are, or change the limit in Settings. Each button that uses AI shows the cost and what is left. Local models don’t use the budget.',
          '**The assistant in Workspace** can brainstorm and draft. It never changes your scene by itself: replacing or adding text opens a preview of the current and proposed text, and nothing changes until you confirm. You can also save a reply as a Source Note.',
          '**Ask your project** (under **More**) answers questions about your story. When it recognizes a factual question, it answers from your saved records and scenes, or says it can’t confirm the answer, instead of letting a model guess.'
        ]
      }
    ],
    links: [
      {label: 'Settings', to: '/settings'},
      {label: 'Ask your project', to: '/ask'}
    ]
  },
  {
    id: 'privacy',
    title: 'Where your data goes',
    summary: 'What stays on this computer, and exactly when anything leaves it.',
    keywords: ['privacy', 'data', 'local', 'telemetry', 'training', 'passphrase', 'protect', 'lock', 'encrypt', 'network', 'offline', 'updates', 'ollama cloud', 'search model'],
    blocks: [
      {
        kind: 'list',
        items: [
          '**Your projects are stored on this computer.** SagaSpine has no account and no server of its own, so it never receives your writing and never uses it to train anything.',
          '**No telemetry.** SagaSpine doesn’t report usage or send crash reports. **Settings → Diagnostics** keeps a short local error log that you can copy if you want to report a problem; it leaves out your text and keys.',
          '**Protect with Passphrase** on the Projects page encrypts a project’s data on this computer and asks for the passphrase after a restart or **Lock project**. It doesn’t hide a project while it is unlocked, doesn’t encrypt plain exports, and can’t erase copies written before you protected it.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'Text leaves this computer only in these cases:'
      },
      {
        kind: 'list',
        items: [
          '**Hosted AI, when you ask.** When you use the assistant or another AI action with Anthropic, OpenAI, or Gemini, the text that request needs is sent to that provider under its own terms. This happens only when you start the request, never in the background.',
          '**Local AI stays here.** Ollama or a local model server at an address on this computer keeps everything on this computer. Ollama cloud models and remote addresses are blocked, and the app tells you when a route isn’t verified as local.',
          '**Files you export.** Backups and exports go where you save them.'
        ]
      },
      {
        kind: 'paragraph',
        text: 'The only other network contact is the update check, and it carries no project text. The app asks once whether to check for updates automatically, and never checks before you answer. A check asks GitHub whether a newer version exists. Change this in **Settings → Updates**.'
      },
      {
        kind: 'paragraph',
        text: 'The search model SagaSpine uses to find related passages ships with the app and runs on this computer, so it never needs a download.'
      }
    ],
    links: [
      {label: 'Projects', to: '/projects'},
      {label: 'Settings', to: '/settings'}
    ]
  }
];
