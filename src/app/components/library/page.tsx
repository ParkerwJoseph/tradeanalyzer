'use client'

import { useState, useEffect } from 'react'
import PageTemplate from "@/components/layout/PageTemplate"
import { getConversations, getTickerSearches } from '@/lib/userStore'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Cookies from 'js-cookie'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

export default function LibraryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any>({});
  const [tickerSearches, setTickerSearches] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const uid = Cookies.get('uid');
      if (uid) {
        const convos = await getConversations(uid);
        const searches = await getTickerSearches();
        setConversations(convos);
        setTickerSearches(searches);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleViewConversation = (conversation: any) => {
    localStorage.setItem('selectedConversation', JSON.stringify({
      messages: conversation.messages,
      title: conversation.title,
      id: conversation.id
    }));
    router.push('/components/stock-gpt');
  };

  return (
    <PageTemplate title="Library" description="View your conversation history and popular tickers">
      <div className="container mx-auto p-4">
        <Tabs defaultValue="conversations">
          <TabsList>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="tickers">Popular Tickers</TabsTrigger>
          </TabsList>

          <TabsContent value="conversations">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(conversations).map(([id, convo]: [string, any]) => (
                <Card key={id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{convo.title}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {format(convo.createdAt, 'PPp')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      {convo.messages.length} messages
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => handleViewConversation(convo)}
                    >
                      View Conversation
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTemplate>
  );
} 