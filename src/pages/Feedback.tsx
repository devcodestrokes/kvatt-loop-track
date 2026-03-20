import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, MessageSquare, Mic, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const sentimentEmojis = ['😤', '😕', '😐', '🙂', '🥳'];
const sentimentLabels = ['Very Unhappy', 'Unhappy', 'Neutral', 'Happy', 'Very Happy'];

interface FeedbackRow {
  id: string;
  order_ref: string;
  sentiment_value: number;
  recording_path: string | null;
  created_at: string;
}

function AudioPlayer({ filePath }: { filePath: string }) {
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const { data } = supabase.storage.from('voice-feedback').getPublicUrl(filePath);
    if (data?.publicUrl) {
      setAudioUrl(data.publicUrl);
    }
  }, [filePath]);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.addEventListener('ended', () => setPlaying(false));
    audio.addEventListener('error', () => setError(true));
    return () => {
      audio.pause();
      audio.removeEventListener('ended', () => setPlaying(false));
      audio.removeEventListener('error', () => setError(true));
    };
  }, [audioUrl]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  if (error) return <span className="text-xs text-muted-foreground">Audio unavailable</span>;

  return (
    <Button variant="outline" size="sm" onClick={toggle} className="gap-1.5">
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {playing ? 'Pause' : 'Play'}
    </Button>
  );
}

export default function Feedback() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      const { data, error } = await supabase
        .from('customer_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFeedback(data as FeedbackRow[]);
      }
      setLoading(false);
    };
    fetchFeedback();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Customer Feedback</h1>
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {feedback.length} feedback {feedback.length === 1 ? 'entry' : 'entries'} received
        </p>
      </div>

      {feedback.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No feedback yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Customer feedback will appear here once submitted.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {feedback.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4 flex items-center gap-4">
                {/* Sentiment emoji */}
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-3xl">{sentimentEmojis[item.sentiment_value] || '😐'}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 font-medium">
                    {sentimentLabels[item.sentiment_value] || 'Unknown'}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">Order {item.order_ref}</span>
                    <Badge variant={item.recording_path ? 'default' : 'secondary'} className="text-[10px] h-5">
                      {item.recording_path ? (
                        <><Mic className="h-3 w-3 mr-1" /> Voice</>
                      ) : (
                        'Slider only'
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(item.created_at), 'MMM d, yyyy · h:mm a')}
                  </div>
                </div>

                {/* Audio player */}
                {item.recording_path && (
                  <AudioPlayer filePath={item.recording_path} />
                )}

                {/* Sentiment bar */}
                <div className="hidden md:flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="w-2 h-6 rounded-full transition-colors"
                      style={{
                        backgroundColor: i <= item.sentiment_value
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--muted))',
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
