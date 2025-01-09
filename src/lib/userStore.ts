import { database } from './firebase';
import { ref, set, get, update, push, increment as rtdbIncrement } from 'firebase/database';
import Cookies from 'js-cookie';

interface Conversation {
  id: string;
  title: string;
  messages: {
    type: 'user' | 'system' | 'error' | 'data' | 'chart';
    content: string;
    timestamp: number;
    data?: any;
    ticker?: string;
  }[];
  createdAt: number;
}

interface UserData {
  uid: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  displayName?: string;
  photoURL?: string;
  subscriptionType: 'free' | 'premium' | 'enterprise';
  questionCount: number;
  conversations: { [key: string]: Conversation };
  createdAt: string;
  lastLogin: string;
  updatedAt?: string;
  riskAnalysis?: {
    riskToleranceScore: number;
    riskLevel: 'Conservative' | 'Moderate' | 'Aggressive';
    holdingPeriodAnalysis?: string;
    instrumentAnalysis?: string;
    leveragedExposure?: string;
    dividendExposure?: string;
  };
  lastAnalysisDate?: string;
}

export const initializeUserData = async (uid: string) => {
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      const userData: UserData = {
        uid,
        email: '',
        subscriptionType: 'free',
        questionCount: 0,
        conversations: {},
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      
      await set(userRef, userData);
      // Log new user activity
      await logUserActivity(uid, 'USER_CREATED');
    } else {
      // Update last login
      await update(userRef, {
        lastLogin: new Date().toISOString()
      });
      // Log login activity
      await logUserActivity(uid, 'USER_LOGIN');
    }

    Cookies.set('uid', uid, { expires: 30 });
    return true;
  } catch (error) {
    console.error('Error initializing user data:', error);
    return false;
  }
};

// Add a helper function to create safe timestamp keys
const createSafeTimestamp = () => {
  return new Date().getTime().toString();
};

export const trackUserQuestion = async (uid: string, question: string) => {
  try {
    const timestamp = createSafeTimestamp();
    const questionRef = ref(database, `users/${uid}/questions/${timestamp}`);
    await set(questionRef, {
      question,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error tracking user question:', error);
  }
};

export const logUserActivity = async (uid: string, activity: string) => {
  try {
    const timestamp = createSafeTimestamp();
    const activityRef = ref(database, `users/${uid}/activity/${timestamp}`);
    await set(activityRef, {
      activity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const saveConversation = async (uid: string, conversationId: string, messages: any[]) => {
  try {
    const conversationRef = ref(database, `users/${uid}/conversations/${conversationId}`);
    await set(conversationRef, {
      messages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
};

export const getConversations = async (uid: string) => {
  try {
    const conversationsRef = ref(database, `users/${uid}/conversations`);
    const snapshot = await get(conversationsRef);
    const data = snapshot.val();
    
    if (!data) return {};
    
    return Object.entries(data).reduce((acc: any, [id, conv]: [string, any]) => {
      try {
        // Handle messages array if it exists
        const messages = conv.messages ? Object.values(conv.messages).map((msg: any) => ({
          type: msg.type || 'system',
          content: msg.content || '',
          timestamp: msg.timestamp || conv.createdAt,
          ticker: msg.ticker || null,
          data: msg.data || null
        })) : [];

        acc[id] = {
          id,
          title: conv.title || 'Untitled',
          messages,
          createdAt: conv.createdAt || Date.now()
        };
      } catch (err) {
        console.error(`Error processing conversation ${id}:`, err);
      }
      return acc;
    }, {});
    
  } catch (error) {
    console.error('Error getting conversations:', error);
    return {};
  }
};

export const trackTickerSearch = async (uid: string, ticker: string) => {
  try {
    const timestamp = createSafeTimestamp();
    const searchRef = ref(database, `users/${uid}/searches/${timestamp}`);
    await set(searchRef, {
      ticker,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error tracking ticker search:', error);
  }
};

export const getTickerSearches = async () => {
  try {
    const symbolsRef = ref(database, 'symbols');
    const snapshot = await get(symbolsRef);
    return snapshot.val() || {};
  } catch (error) {
    console.error('Error getting ticker searches:', error);
    return {};
  }
}; 