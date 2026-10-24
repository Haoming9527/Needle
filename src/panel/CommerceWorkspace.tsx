import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Collection,
  GroupBuyCampaign,
  SavedItem,
} from "../../shared/commerce";
import { apiRequest } from "./api";
import { formatMoney, ProductImage } from "./ui";
import { assetUrl } from "./CheckoutDialog";
export function CommerceWorkspace({
  refreshKey = 0,
  onChanged,
}: {
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<"saved" | "collections" | "groups">("saved");
  const [items, setItems] = useState<SavedItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<GroupBuyCampaign[]>([]);
  const [name, setName] = useState("Lunch on the move");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const mounted = useRef(false);
  const version = useRef(0);
  const mutation = useRef(false);
  const refresh = useCallback(async () => {
    const revision = ++version.current;
    const signal = AbortSignal.timeout(8000);
    const [a, b, c] = await Promise.all([
      apiRequest<{ items: SavedItem[] }>("/saved-items", undefined, signal),
      apiRequest<{ collections: Collection[] }>(
        "/collections",
        undefined,
        signal,
      ),
      apiRequest<{ campaigns: GroupBuyCampaign[] }>(
        "/group-buys",
        undefined,
        signal,
      ),
    ]);
    if (!mounted.current || revision !== version.current) return;
    setItems(a.items);
    setCollections(b.collections);
    setGroups(c.campaigns);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      version.current++;
    };
  }, []);
  useEffect(() => {
    void refresh().catch((e) => {
      if (mounted.current) setError(e.message);
    });
  }, [refreshKey, refresh]);
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== 'visible' || mutation.current) return;
      void refresh().catch((failure) => {
        if (mounted.current) setError(failure instanceof Error ? failure.message : 'Saved items could not be refreshed.');
      });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);
  async function mutate(path: string, body: unknown) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      await apiRequest(path, body, AbortSignal.timeout(8000));
      await refresh();
      if (mounted.current) onChanged?.();
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not save this change.",
        );
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const hasActiveGroup = (item: SavedItem) =>
    groups.some(
      (group) =>
        group.state !== "expired" &&
        Date.parse(group.expiresAt) > Date.now() &&
        group.currency === (item.offer?.currency ?? "USD") &&
        (group.savedItem.id === item.id ||
          group.savedItem.offer?.id === item.offer?.id),
    );
  return (
    <section
      className="commerce-workspace"
      aria-label="Saved inspiration and demo group buys"
    >
      <header className="commerce-heading">
        <h2>Save now. Decide later.</h2>
        <p>
          Connect inspiration across websites. Keep the things you like, without
          committing to buy.
        </p>
      </header>
      <nav className="commerce-tabs" aria-label="Collections workspace">
        {(["saved", "collections", "groups"] as const).map((value) => (
          <button
            className="text-button"
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "saved"
              ? "Saved inspiration"
              : value === "collections"
                ? "Collections"
                : "Group buys"}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="commerce-error">
          {error}
        </p>
      )}
      {tab !== "groups" && (
        <form
          className="commerce-form"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("/collections", { name });
          }}
        >
          <label>
            New collection
            <input
              aria-label="New collection name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="secondary-button" disabled={busy || !name.trim()}>
            Create collection
          </button>
        </form>
      )}
      {tab === "saved" && (
        <div className="commerce-cards">
          {!items.length && (
            <p className="small-note">
              Save inspiration across websites or save a product from a
              discovery result.
            </p>
          )}
          {items.map((item) => (
            <article key={item.id} className="commerce-card">
              {item.offer && (
                <ProductImage
                  src={assetUrl(item.offer.imageUrl)}
                  alt={item.label}
                />
              )}
              <div className="commerce-card-content">
                <div className="commerce-source">
                  <span className="commerce-pill">
                    {item.provenance === "demo_fixture"
                      ? "Demo fixture"
                      : "Saved interaction"}
                  </span>
                  <span>
                    {item.sourceTitle ?? item.sourceOrigin ?? "Needle"}
                  </span>
                </div>
                <h3>{item.label}</h3>
                {item.summary && <p>{item.summary}</p>}
                <label className="commerce-field">
                  Add to collection
                  <select
                    value=""
                    disabled={busy || !collections.length}
                    onChange={(e) =>
                      void mutate(
                        `/collections/${encodeURIComponent(e.target.value)}/items`,
                        { savedItemId: item.id },
                      )
                    }
                  >
                    <option value="">Choose collection</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.itemIds.includes(item.id) ? " (saved)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {item.offer && (
                  <div className="commerce-form">
                    <label>
                      Illustrative target price ({item.offer.currency ?? "USD"})
                      <input
                        aria-label={`Target price for ${item.label}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          prices[item.id] ?? String(item.offer.price ?? 20)
                        }
                        onChange={(e) =>
                          setPrices({ ...prices, [item.id]: e.target.value })
                        }
                      />
                    </label>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => {
                        if (hasActiveGroup(item)) {
                          setTab("groups");
                          return;
                        }
                        void mutate("/group-buys", {
                          savedItemId: item.id,
                          targetParticipants: 3,
                          targetPrice: Number(
                            prices[item.id] ?? item.offer?.price ?? 20,
                          ),
                          currency: item.offer?.currency ?? "USD",
                        });
                        setTab("groups");
                      }}
                    >
                      {hasActiveGroup(item)
                        ? "View demo group"
                        : "Start demo group"}
                    </button>
                  </div>
                )}
                <div className="commerce-actions">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/saved-items/${encodeURIComponent(item.id)}/remove`,
                        {},
                      )
                    }
                  >
                    Remove saved item
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {tab === "collections" && (
        <div className="commerce-cards">
          {!collections.length && (
            <p className="small-note">
              Create a collection to connect inspiration from different
              websites.
            </p>
          )}
          {collections.map((c) => (
            <article key={c.id} className="commerce-card">
              <div className="commerce-card-content">
                <span className="commerce-pill">{c.itemIds.length} saved</span>
                <h3>{c.name}</h3>
                {c.itemIds.length ? (
                  <ul className="commerce-collection-items">
                    {c.itemIds.map((id) => (
                      <li key={id}>
                        {items.find((i) => i.id === id)?.label ??
                          "Removed item"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Add saved inspiration from the Saved tab.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {tab === "groups" && (
        <>
          <p className="commerce-disclosure">
            <strong>Local simulation.</strong> Each group includes 2 synthetic
            participants. Prices are illustrative; no retailer agreement,
            payment, or order.
          </p>
          <div className="commerce-cards">
            {!groups.length && (
              <p className="small-note">
                Save a product, then start a demo group from its saved card.
              </p>
            )}
            {groups.map((group) => (
              <article key={group.id} className="commerce-card">
                {group.savedItem.offer && (
                  <ProductImage
                    src={assetUrl(group.savedItem.offer.imageUrl)}
                    alt={group.savedItem.label}
                  />
                )}
                <div className="commerce-card-content">
                  <span className="commerce-pill">Demo group</span>
                  <h3>{group.savedItem.label}</h3>
                  <p>
                    Illustrative target:{" "}
                    <strong>
                      {formatMoney(group.targetPrice, group.currency)}
                    </strong>
                  </p>
                  <label className="commerce-progress">
                    {group.eligibleParticipants}/{group.targetParticipants}{" "}
                    eligible participants
                    <progress
                      value={group.eligibleParticipants}
                      max={group.targetParticipants}
                    />
                  </label>
                  <p className="small-note">
                    2 synthetic participants
                    {group.eligibleParticipants > 2 ? " + you" : ""}
                  </p>
                  <strong>
                    {group.state === "expired"
                      ? "Expired"
                      : group.state === "target_reached"
                        ? "Demo target reached — separate purchase review required"
                        : "Collecting conditional interest"}
                  </strong>
                  <small>
                    Expires {new Date(group.expiresAt).toLocaleString()}
                  </small>
                  {group.localPledge && (
                    <p>
                      Your maximum:{" "}
                      {formatMoney(group.localPledge.maxPrice, group.currency)}
                      {group.localPledge.maxPrice < group.targetPrice
                        ? " — below the target; not counted as eligible."
                        : ". No payment taken."}
                    </p>
                  )}
                  <div className="commerce-form">
                    <label>
                      My maximum unit price ({group.currency})
                      <input
                        aria-label={`Maximum price for ${group.savedItem.label}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          prices[group.id] ??
                          String(
                            group.localPledge?.maxPrice ?? group.targetPrice,
                          )
                        }
                        onChange={(e) =>
                          setPrices({ ...prices, [group.id]: e.target.value })
                        }
                      />
                    </label>
                    <button
                      className="primary-button"
                      disabled={busy || group.state === "expired"}
                      onClick={() =>
                        void mutate(`/group-buys/${group.id}/join`, {
                          maxPrice: Number(
                            prices[group.id] ??
                              group.localPledge?.maxPrice ??
                              group.targetPrice,
                          ),
                          currency: group.currency,
                        })
                      }
                    >
                      {group.localPledge
                        ? "Update conditional interest"
                        : "Express interest — no payment"}
                    </button>
                  </div>
                  {group.localPledge && (
                    <div className="commerce-actions">
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void mutate(`/group-buys/${group.id}/leave`, {})
                        }
                      >
                        Withdraw interest
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
