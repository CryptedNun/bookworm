Issues:
- (NOT A SEVERE ISSUE) Pressing "+ Inser Block (Ctrl + Enter)" doesn't immediately show new block, requires refreshing, not a serious issue.

- After going into an empty notebook using "Read Notebook", the "Create First Note" button doesn't work. Requires pressing "Manage Notes" and then creating a note there.

- After publishing an Edition of a note, note's original indentation and text format is not preserved inside the edition.

- (NEEDS FURTHER REVIEW FOR BUG FINDING) Issues and Branching has multiple bugs.
When an owner or a maintainer is trying to edit text on a note's issued block's branch only (Not the main branch), the saved text is not properly saved on that specific issue branch, instead the program confuses the main and the issue branch text, bugging out that block.
The issue branch should be separate from the main branch. (Eita in-details bujhaite paarbo jodi problem ta physically show korte paari, instead of describing it on a .md file, the problem is much larger than this)

- (NOT REALLY AN ISSUE) A note or notebook, once created, cannot change it's access permissions, ie a notebook that was private, remains private, this is a design choice not an issue.

- (ISSUE FIXED!) When a contributor tries to edit the text of a block on their issued branch, they get "Insufficient permissions to edit this note" error. Effectively disallowing a contributor to work on their branch.

- If user_3 creates a notebook, user_2 sees that notebook on the left side of their dashboard despite not owning, contributing or maintaining it.

- When a notebook owner invites another user, the invited user directly gets access to the notebook instead of first receiving an invitation.