import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useHideSplashScreenCallback,
  useKeplerBackHandler,
  usePreventHideSplashScreen,
} from '@amazon-devices/react-native-kepler';

const STATUS_URL =
  'https://kellner-dot.github.io/seth-dashboard/mission-control/status.json';
const REFRESH_MS = 30000;

type Device = {
  id: string;
  name: string;
  kind: string;
  ip?: string;
  online: boolean;
  ping_ms?: number | null;
  emby?: {running: boolean; version: string};
  rvg_version?: string;
  uptime_s?: number;
  hostname?: string;
};

type StatusData = {
  generated_iso?: string;
  devices?: Device[];
  emby_library?: {movies: number; series: number; episodes: number; recent: string[]};
  github?: {public_repos: number; private_repos: number};
  biglybt?: {running: boolean};
  alerts?: string[];
};

function formatUptime(s?: number): string {
  if (!s && s !== 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = now.getHours() % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ap = now.getHours() >= 12 ? 'PM' : 'AM';
  return <Text style={styles.clock}>{`${hh}:${mm} ${ap}`}</Text>;
}

function FocusCard({
  children,
  onPress,
  autoFocus,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  autoFocus?: boolean;
  style?: object;
}) {
  const [focused, setFocused] = useState(false);
  const viewRef = useRef<any>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => {
      viewRef.current?.requestTVFocus?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);
  return (
    <Pressable
      ref={viewRef}
      focusable
      hasTVPreferredFocus={autoFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.card, focused && styles.cardFocused, style]}>
      {children}
      {focused && <View style={styles.focusRing} />}
    </Pressable>
  );
}

function DeviceCard({
  device,
  autoFocus,
  onPress,
}: {
  device: Device;
  autoFocus?: boolean;
  onPress: () => void;
}) {
  const dot = device.online ? styles.dotOnline : styles.dotOffline;
  return (
    <FocusCard autoFocus={autoFocus} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={[styles.dot, dot]} />
        <Text style={styles.cardTitle}>{device.name}</Text>
      </View>
      <Text style={styles.cardSub}>{device.kind}</Text>
      <Text style={styles.cardMeta}>
        {device.online ? 'ONLINE' : 'OFFLINE'}
        {device.ping_ms != null ? ` · ${device.ping_ms}ms` : ''}
      </Text>
      {device.emby && (
        <Text style={styles.cardMeta}>
          Emby {device.emby.version} {device.emby.running ? '●' : '○'}
        </Text>
      )}
      {device.uptime_s != null && (
        <Text style={styles.cardMeta}>up {formatUptime(device.uptime_s)}</Text>
      )}
    </FocusCard>
  );
}

function DetailOverlay({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ref.current?.requestTVFocus?.();
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <View style={styles.overlay}>
      <Pressable
        ref={ref}
        focusable
        hasTVPreferredFocus
        onPress={onClose}
        style={styles.overlayCard}>
        <Text style={styles.overlayTitle}>{device.name}</Text>
        <Text style={styles.overlayRow}>Status: {device.online ? 'ONLINE' : 'OFFLINE'}</Text>
        {!!device.hostname && <Text style={styles.overlayRow}>Host: {device.hostname}</Text>}
        {!!device.ip && <Text style={styles.overlayRow}>IP: {device.ip}</Text>}
        {device.uptime_s != null && (
          <Text style={styles.overlayRow}>Uptime: {formatUptime(device.uptime_s)}</Text>
        )}
        {!!device.rvg_version && (
          <Text style={styles.overlayRow}>RVG: v{device.rvg_version}</Text>
        )}
        {device.emby && (
          <Text style={styles.overlayRow}>
            Emby {device.emby.version} ({device.emby.running ? 'running' : 'stopped'})
          </Text>
        )}
        <Text style={styles.overlayHint}>Press BACK to close</Text>
      </Pressable>
    </View>
  );
}

export const App = () => {
  usePreventHideSplashScreen();
  const hideSplash = useHideSplashScreenCallback();
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Device | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const backHandler = useKeplerBackHandler();

  const load = useCallback(async () => {
    try {
      const res = await fetch(STATUS_URL, {headers: {'Cache-Control': 'no-store'}});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StatusData;
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'fetch failed');
    }
  }, []);

  useEffect(() => {
    load().finally(() => hideSplash());
    const t = setInterval(() => {
      load();
      setRefreshTick(x => x + 1);
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load, hideSplash]);

  useEffect(() => {
    const sub = backHandler.addEventListener('hardwareBackPress', () => {
      if (selected) {
        setSelected(null);
        return true; // consumed — closed overlay
      }
      return false; // at root — let platform exit
    });
    return () => sub.remove();
  }, [backHandler, selected]);

  const devices = data?.devices ?? [];
  const emby = data?.emby_library;
  const gh = data?.github;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MISSION CONTROL</Text>
        <View style={styles.headerRight}>
          <View style={styles.liveBadge}>
            <View style={[styles.dot, styles.dotOnline, styles.liveDot]} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Clock />
        </View>
      </View>

      {error && !data && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Couldn't reach dashboard: {error}</Text>
          <FocusCard autoFocus onPress={load}>
            <Text style={styles.cardTitle}>Retry</Text>
          </FocusCard>
        </View>
      )}

      {(!data || !error) && !error && !data && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22d3ee" />
        </View>
      )}

      {data && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
          <Text style={styles.sectionTitle}>FLEET</Text>
          <View style={styles.grid}>
            {devices.map((d, i) => (
              <DeviceCard
                key={d.id}
                device={d}
                autoFocus={i === 0 && !selected}
                onPress={() => setSelected(d)}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>MEDIA</Text>
          <View style={styles.grid}>
            <View style={[styles.card, styles.statCard]}>
              <Text style={styles.statNum}>{emby?.movies ?? '—'}</Text>
              <Text style={styles.cardSub}>Emby movies</Text>
            </View>
            <View style={[styles.card, styles.statCard]}>
              <Text style={styles.statNum}>{emby?.series ?? '—'}</Text>
              <Text style={styles.cardSub}>Series</Text>
            </View>
            <View style={[styles.card, styles.statCard]}>
              <Text style={styles.statNum}>{emby?.episodes ?? '—'}</Text>
              <Text style={styles.cardSub}>Episodes</Text>
            </View>
            <View style={[styles.card, styles.statCard]}>
              <Text style={styles.statNum}>
                {(gh?.public_repos ?? 0) + (gh?.private_repos ?? 0)}
              </Text>
              <Text style={styles.cardSub}>GitHub repos</Text>
            </View>
          </View>

          {!!emby?.recent?.length && (
            <>
              <Text style={styles.sectionTitle}>RECENTLY ADDED</Text>
              <Text style={styles.recentText}>{emby.recent.slice(0, 6).join('  ·  ')}</Text>
            </>
          )}

          <Text style={styles.footer}>
            Updated {data.generated_iso ?? '—'} · auto-refresh 30s · tick {refreshTick}
          </Text>
        </ScrollView>
      )}

      {selected && <DetailOverlay device={selected} onClose={() => setSelected(null)} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0e1a'},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {color: '#f1f5f9', fontSize: 34, fontWeight: '800', letterSpacing: 4},
  headerRight: {flexDirection: 'row', alignItems: 'center'},
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14532d',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 18,
  },
  liveDot: {width: 10, height: 10, marginRight: 8},
  liveText: {color: '#bbf7d0', fontSize: 18, fontWeight: '700'},
  clock: {color: '#f1f5f9', fontSize: 30, fontWeight: '600'},
  body: {flex: 1},
  bodyInner: {padding: 40},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  sectionTitle: {
    color: '#64748b',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 14,
    marginTop: 10,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8},
  card: {
    width: 380,
    backgroundColor: '#111a2e',
    borderRadius: 14,
    padding: 22,
    marginRight: 18,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardFocused: {borderColor: '#22d3ee', transform: [{scale: 1.03}]},
  focusRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#22d3ee',
    opacity: 0.5,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 6},
  dot: {width: 14, height: 14, borderRadius: 7, marginRight: 10},
  dotOnline: {backgroundColor: '#22c55e'},
  dotOffline: {backgroundColor: '#ef4444'},
  cardTitle: {color: '#f1f5f9', fontSize: 26, fontWeight: '700'},
  cardSub: {color: '#94a3b8', fontSize: 19, marginTop: 2},
  cardMeta: {color: '#cbd5e1', fontSize: 19, marginTop: 6},
  statCard: {justifyContent: 'center', minHeight: 130},
  statNum: {color: '#22d3ee', fontSize: 52, fontWeight: '800'},
  recentText: {color: '#94a3b8', fontSize: 20, lineHeight: 32},
  footer: {color: '#475569', fontSize: 16, marginTop: 26},
  errorText: {color: '#f87171', fontSize: 22, marginBottom: 20},
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,6,16,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCard: {
    width: 640,
    backgroundColor: '#111a2e',
    borderRadius: 18,
    padding: 36,
    borderWidth: 2,
    borderColor: '#22d3ee',
  },
  overlayTitle: {color: '#f1f5f9', fontSize: 36, fontWeight: '800', marginBottom: 16},
  overlayRow: {color: '#cbd5e1', fontSize: 24, marginTop: 10},
  overlayHint: {color: '#64748b', fontSize: 18, marginTop: 24},
});
