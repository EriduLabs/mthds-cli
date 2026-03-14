export interface ChecklistItem {
    id: number;
    text: string;
    is_completed: boolean;
}

export interface Checklist {
    id: number;
    title: string;
    items: ChecklistItem[];
}

export interface Comment {
    id: number;
    text: string;
    is_ai: boolean;
    created_at: string;
    author_name?: string;
}

export interface Attachment {
    id: number;
    filename: string;
    file_url: string;
}

export interface BoardLabel {
    id: number;
    name: string;
    color: string;
}

export interface User {
    id: number;
    username: string;
}

export interface ActivityLog {
    id: number;
    user: User | null;
    action_type: string;
    description: string;
    created_at: string;
}

export interface TaskCard {
    id: number;
    title: string;
    description: string;
    order: number;
    color_boost: string;
    metadata: Record<string, any>;
    list_id: number;
    due_date: string | null;
    labels: string[];
    board_labels: BoardLabel[];
    assignees: User[];
    is_archived: boolean;
    checklists: Checklist[];
    comments: Comment[];
    attachments: Attachment[];
    activity_logs: ActivityLog[];
}

export interface ListData {
    id: number;
    name: string;
    order: number;
    color: string;
    is_archived: boolean;
    agent_state_mapping?: string;
    cards: TaskCard[];
}

export interface BoardData {
    id: number;
    title: string;
    is_archived: boolean;
    lists: ListData[];
    labels: BoardLabel[];
    owner: User;
    members: User[];
}
