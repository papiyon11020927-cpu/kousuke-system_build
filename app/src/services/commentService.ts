import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/firebase/config';
import type { ProjectComment } from '@/types';

const ref = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'project_comments', id);

export const saveComment = async (
  projectId: string,
  userId: string,
  userName: string,
  commentText: string,
): Promise<void> => {
  const id = 'COM-' + Date.now();
  const comment: ProjectComment = {
    commentId: id, projectId, userId, userName,
    commentText, createdAt: new Date().toISOString(),
  };
  await setDoc(ref(id), comment);
};

export const deleteComment = async (commentId: string): Promise<void> => {
  await deleteDoc(ref(commentId));
};
