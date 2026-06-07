import { db, fetchUserBookings } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore/lite';
import { callOpenRouter } from '../utils/openRouter';

export class MemoryAgent {
  async learnFinancialPreferences(userId: string): Promise<any> {
    if (!userId || userId === 'guest' || userId.startsWith('test-user-')) {
      console.log(`[MemoryAgent] Skipping preference learning for guest/test user: ${userId}`);
      return null;
    }

    console.log(`\n[MemoryAgent] Analyzing financial preferences for user: ${userId}...`);

    try {
      // 1. Fetch user bookings
      const bookings = await fetchUserBookings(userId);
      const bookingIds = bookings.map(b => b.id);
      
      // 2. Fetch transactions
      const txCol = collection(db, 'transactions');
      const txQuery = query(txCol, where('userId', '==', userId));
      const txSnap = await getDocs(txQuery);
      const transactions: any[] = [];
      txSnap.forEach(d => transactions.push(d.data()));

      // 3. Fetch disputes (filter in memory by user booking IDs)
      const disputesCol = collection(db, 'disputes');
      const disputesSnap = await getDocs(disputesCol);
      const disputes: any[] = [];
      disputesSnap.forEach(d => {
        const data = d.data();
        if (bookingIds.includes(data.bookingId)) {
          disputes.push(data);
        }
      });

      console.log(`[MemoryAgent] Fetched ${bookings.length} booking(s), ${transactions.length} transaction(s), and ${disputes.length} dispute(s).`);

      // If no history exists, set default medium profile
      if (bookings.length === 0 && transactions.length === 0) {
        const defaultProfile = {
          budgetTier: 'medium',
          typicalSpend: 0,
          summary: "Customer ka koi pichla record nahi mila. Shuruat me medium budget matching active hai.",
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', userId), { financialPreferences: defaultProfile }, { merge: true });
        console.log(`[MemoryAgent] No history found. Saved default profile for user ${userId}.`);
        return defaultProfile;
      }

      // Compile historical profile for LLM
      const historyContext = {
        bookings: bookings.map(b => ({
          price: b.price || 0,
          status: b.status || 'unknown',
          providerName: b.providerName || 'unknown',
          category: b.category || 'unknown',
          date: b.date || 'unknown'
        })),
        transactions: transactions.map(t => ({
          amount: t.amount || 0,
          type: t.type || 'unknown',
          description: t.description || ''
        })),
        disputes: disputes.map(d => ({
          issueType: d.issueType || 'unknown',
          verdictSummary: d.verdictSummary || '',
          refundAmount: d.refundAmount || 0,
          action: d.action || 'unknown'
        }))
      };

      const systemPrompt = `
        You are the Financial Profiler Agent for Wasila.
        Analyze the customer's historical transactions, bookings, and disputes to learn their financial preference pattern.
        
        Classify the customer into one of the following budget tiers:
        - "budget": Customer consistently chooses cheaper options, negotiates aggressively, has lower average booking values (typically under Rs. 1300), or has disputed overcharges.
        - "premium": Customer has higher booking values (typically Rs. 1600+), rarely/never negotiates, prioritizes ratings over cost, or pays full standard quotes without issues.
        - "medium": Customer balance price and rating (typically spend Rs. 1300 to Rs. 1600), accepts reasonable offers, or has mixed history.

        Calculate their "typicalSpend" (average completed booking value). If no bookings are completed, set it to the average of their bookings.
        Write a concise, friendly summary in Roman Urdu explaining their financial spending preference (keep it under 2 sentences).

        You MUST respond ONLY with a JSON object:
        {
          "budgetTier": "budget" | "medium" | "premium",
          "typicalSpend": number,
          "summary": "Roman Urdu explanation of user's spending preference."
        }
      `;

      const userPrompt = `
        Customer History Data:
        ${JSON.stringify(historyContext, null, 2)}
      `;

      const responseText = await callOpenRouter(systemPrompt, userPrompt, { isJson: true });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

      const learnedProfile = {
        budgetTier: parsed.budgetTier || 'medium',
        typicalSpend: Number(parsed.typicalSpend) || 0,
        summary: parsed.summary || "Customer moderate rates aur standard budget preferences rakhte hain.",
        updatedAt: new Date().toISOString()
      };

      // Save to user's profile in Firestore
      await setDoc(doc(db, 'users', userId), { financialPreferences: learnedProfile }, { merge: true });
      console.log(`[MemoryAgent] Successfully saved learned preferences for user ${userId}:`, learnedProfile);

      return learnedProfile;
    } catch (err: any) {
      console.error(`[MemoryAgent] Failed to learn preferences for user ${userId}:`, err.message);
      return null;
    }
  }
}
