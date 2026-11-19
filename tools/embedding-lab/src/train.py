"""정적 임베딩(토큰 벡터의 합)을 큰 모델의 문단 벡터에 맞춰 학습하고 평가한다.
usage: train.py <out_dir> <teacher_prefix> <configs: V:d:ntrain,...> [--epochs N] [--save V:d]
평가: 학습에 쓰지 않은 문서에서, 큰 모델 기준 5색 구간별로 고르게 뽑은 (목표, 문서) 쌍.
"""
import sys, json, time, numpy as np, torch
from scipy.stats import spearmanr

out_dir, prefix, cfgs = sys.argv[1], sys.argv[2], sys.argv[3]
epochs = int(sys.argv[sys.argv.index("--epochs") + 1]) if "--epochs" in sys.argv else 12
save = sys.argv[sys.argv.index("--save") + 1] if "--save" in sys.argv else None
use_init = "--init" in sys.argv
lr = float(sys.argv[sys.argv.index("--lr") + 1]) if "--lr" in sys.argv else 3e-3
import os
D, NEVAL = 768, 6000
LO, HI = 0.27, 0.65                      # 설계 문서 6.1의 보정 구간
EDGES = LO + (HI - LO) * np.array([0.2, 0.4, 0.6, 0.8])
dev = "mps" if torch.backends.mps.is_available() else "cpu"
torch.manual_seed(0); rng = np.random.default_rng(0)

def load_teacher():
    idxs, vecs = [], []
    for k in range(6):
        try:
            ids = np.loadtxt(f"{prefix}.{k}.idx", dtype=np.int64, ndmin=1)
            raw = np.fromfile(f"{prefix}.{k}.f32", dtype=np.float32)
        except OSError:
            continue
        n = min(len(ids), len(raw) // D)
        idxs.append(ids[:n]); vecs.append(raw[: n * D].reshape(n, D))
    idx = np.concatenate(idxs); vec = np.concatenate(vecs)
    idx, first = np.unique(idx, return_index=True)       # 겹친 문서는 하나만
    vec = vec[first]; vec /= np.linalg.norm(vec, axis=1, keepdims=True)
    return idx, vec

doc_idx, T = load_teacher()
ev = doc_idx < NEVAL
ev_idx, T_ev = doc_idx[ev], T[ev]
NCAL = 3000                                   # 보정 전용 문서: 학습에도 평가에도 쓰지 않는다
cal = (doc_idx >= NEVAL) & (doc_idx < NEVAL + NCAL)
cal_idx, T_cal = doc_idx[cal], T[cal]
tr = doc_idx >= NEVAL + NCAL
tr_idx_all, T_tr_all = doc_idx[tr], T[tr]
drop = float(sys.argv[sys.argv.index("--drop") + 1]) if "--drop" in sys.argv else 0.15
lam = float(sys.argv[sys.argv.index("--lam") + 1]) if "--lam" in sys.argv else 10.0
print(f"teacher docs={len(doc_idx)} eval={len(ev_idx)} train={len(tr_idx_all)} dev={dev}", flush=True)

def bucket(s):
    return np.digitize(s, EDGES)

def stratified_pairs(Tm, n_targets, per_bucket):
    """목표 문서마다 큰 모델 기준 5구간에서 per_bucket개씩 뽑는다."""
    targets = rng.choice(len(Tm), size=min(n_targets, len(Tm)), replace=False)
    I, J = [], []
    for t in targets:
        s = Tm @ Tm[t]
        s[t] = -1
        b = bucket(s)
        for k in range(5):
            cand = np.flatnonzero((b == k) & (s > -1))
            if len(cand):
                pick = rng.choice(cand, size=min(per_bucket, len(cand)), replace=False)
                I += [t] * len(pick); J += list(pick)
    I, J = np.array(I), np.array(J)
    return I, J, np.einsum("ij,ij->i", Tm[I], Tm[J])

evI, evJ, ev_s = stratified_pairs(T_ev, 400, 8)
print("eval pairs", len(ev_s), "per bucket", np.bincount(bucket(ev_s), minlength=5).tolist(), flush=True)

def report(name, s_student, s_teacher, fit=None):
    """s_student를 선형 보정해 큰 모델 눈금에 맞춘 뒤 5색 일치도를 본다."""
    a, b = fit if fit is not None else np.polyfit(s_student, s_teacher, 1)
    cal = a * s_student + b
    bt, bs = bucket(s_teacher), bucket(cal)
    r = {
        "name": name,
        "spearman": round(float(spearmanr(s_student, s_teacher).statistic), 3),
        "exact": round(float((bt == bs).mean()), 3),
        "within1": round(float((np.abs(bt - bs) <= 1).mean()), 3),
        "off2plus": round(float((np.abs(bt - bs) >= 2).mean()), 3),
    }
    return r, (a, b)

# 상한 참고: 큰 모델 벡터를 256/128/64차원으로 줄였을 때
def svd_proj(Tm, d):
    _, _, Vt = np.linalg.svd(Tm[:min(20000, len(Tm))], full_matrices=False)
    return Vt[:d].T.astype(np.float32)

P_cache = {}
def proj(d):
    if d not in P_cache:
        P_cache[d] = svd_proj(T_tr_all, d)
    return P_cache[d]

def cos_rows(A, I, J):
    A = A / np.linalg.norm(A, axis=1, keepdims=True)
    return np.einsum("ij,ij->i", A[I], A[J])

results = []
for d in (256, 64):
    r, _ = report(f"큰 모델을 {d}차원으로 축소 (상한)", cos_rows(T_ev @ proj(d), evI, evJ), ev_s)
    results.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)

if os.path.exists(f"{out_dir}/e5_eval.f32") and len(ev_idx) == NEVAL:
    e5 = np.fromfile(f"{out_dir}/e5_eval.f32", dtype=np.float32).reshape(-1, 384)
    if len(e5) == NEVAL:
        r, _ = report("기존 소형 모델 e5-small (118 MB)", cos_rows(e5, evI, evJ), ev_s)
        results.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)

leads = json.load(open(f"{out_dir}/leads_teacher.json")) if __import__("os").path.exists(f"{out_dir}/leads_teacher.json") else None
SETS = [("뉴발란스", ["불고기", "소고기", "소", "가죽", "의류", "패션", "신발", "나이키"]),
        ("세종", ["대한민국", "서울특별시", "조선", "한글", "훈민정음", "이순신", "피자", "축구"]),
        ("외젠 들라크루아", ["대한민국", "문화", "고전주의", "낭만주의", "프랑스", "미술", "반도체"]),
        ("올림픽", ["대한민국", "스포츠", "1988년 하계 올림픽", "서울특별시", "김치", "양자역학"])]
EMO = "🟥🟧🟨🟩🟦"

for cfg in cfgs.split(","):
    V, d, ntrain = (int(x) for x in cfg.split(":"))
    ids_all = np.load(f"{out_dir}/ids{V}.npy")
    tr_idx, T_tr = tr_idx_all[:ntrain], T_tr_all[:ntrain]
    P = proj(d)
    Y = torch.tensor(T_tr @ P); Y = torch.nn.functional.normalize(Y, dim=1).to(dev)
    X = torch.tensor(ids_all[tr_idx], dtype=torch.long).to(dev)
    E = torch.nn.Embedding(V, d, padding_idx=0).to(dev)
    torch.nn.init.normal_(E.weight, std=0.1)
    inited = False
    if use_init and os.path.exists(f"{out_dir}/tokvec{V}.f32"):
        tv = np.fromfile(f"{out_dir}/tokvec{V}.f32", dtype=np.float32).reshape(-1, D)
        if len(tv) == V:   # 토큰 하나만 큰 모델에 넣어 얻은 벡터를 초기값으로
            w0 = tv @ P; w0 /= np.linalg.norm(w0, axis=1, keepdims=True)
            with torch.no_grad(): E.weight.copy_(torch.tensor(w0 * 0.1))
            inited = True
    with torch.no_grad(): E.weight[0].zero_()
    opt = torch.optim.Adam(E.parameters(), lr=lr)
    steps = epochs * (len(X) // 512)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=max(steps, 1))
    loss = torch.tensor(0.0)

    def encode(ids, train=False):
        mask = (ids != 0)
        if train:  # 토큰을 15% 무작위로 가려 과적합을 줄인다
            mask = mask & (torch.rand(ids.shape, device=ids.device) > drop)
        v = (E(ids) * mask.unsqueeze(-1)).sum(1)
        return torch.nn.functional.normalize(v, dim=1)

    t0 = time.time(); step = 0
    for ep in range(epochs):
        perm = torch.randperm(len(X), device=dev)
        for s in range(0, len(X) - 511, 512):
            bi = perm[s : s + 512]
            v, y = encode(X[bi], True), Y[bi]
            loss_dir = (1 - (v * y).sum(1)).mean()
            loss_sim = ((v @ v.T - y @ y.T) ** 2).mean()      # 쌍별 유사도를 직접 맞춘다
            loss = loss_dir + lam * loss_sim
            opt.zero_grad(); loss.backward(); opt.step(); step += 1
            if step < steps: sched.step()
    train_s = time.time() - t0

    W = E.weight.detach().cpu().numpy()
    scale = np.abs(W).max(axis=1, keepdims=True) / 127 + 1e-12          # 행마다 눈금 하나
    Wq = np.round(W / scale).astype(np.int8)
    Wd = Wq.astype(np.float32) * scale                                  # 1바이트로 줄인 뒤 복원

    def enc_np(ids, Wm):
        v = Wm[ids] * (ids != 0)[..., None]
        v = v.sum(1)
        return v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-9)

    # 보정 계수는 학습 문서의 쌍에서 구하고, 평가 문서에는 그대로 적용한다
    cI, cJ, c_s = stratified_pairs(T_cal, 300, 8)
    S_sub = enc_np(ids_all[cal_idx], Wd)
    _, fit = report("fit", np.einsum("ij,ij->i", S_sub[cI], S_sub[cJ]), c_s)

    S_ev = enc_np(ids_all[ev_idx], Wd)
    s_st = np.einsum("ij,ij->i", S_ev[evI], S_ev[evJ])
    mb = V * d / 1e6
    r, _ = report(f"초소형 V={V} d={d} 학습문서={len(X)} ({mb:.1f} MB){' +초기값' if inited else ''} ep={epochs} lr={lr} drop={drop} lam={lam}", s_st, ev_s, fit)
    r["train_s"] = round(train_s); r["loss"] = round(loss.item(), 4)
    bt, bs = bucket(ev_s), bucket(fit[0] * s_st + fit[1])
    r["confusion"] = [[int(((bt == i) & (bs == j)).sum()) for j in range(5)] for i in range(5)]
    results.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)

    if leads and f"{V}:{d}" == save:
        from tokenizers import Tokenizer
        tok = Tokenizer.from_file(f"{out_dir}/tok{V}.json")
        def emb(text):
            x = np.array([tok.encode(text).ids[:192]], dtype=np.int64)
            return enc_np(x, Wd)[0]
        for tgt, path in SETS:
            tv = np.array(leads[tgt]["vec"]); tv /= np.linalg.norm(tv)
            sv = emb(leads[tgt]["text"])
            print(f"# 목표 {tgt}  (왼쪽 큰 모델 / 오른쪽 초소형)")
            for p in path:
                pv = np.array(leads[p]["vec"]); pv /= np.linalg.norm(pv)
                ts = float(tv @ pv); ss = float(fit[0] * (sv @ emb(leads[p]["text"])) + fit[1])
                print(f"  {p}\t{ts:.3f} {EMO[int(bucket(ts))]}   {ss:.3f} {EMO[int(bucket(ss))]}")
        np.save(f"{out_dir}/student_{V}_{d}.int8.npy", Wq)
        np.save(f"{out_dir}/student_{V}_{d}.scale.npy", scale.astype(np.float32))
        json.dump({"fit": [float(fit[0]), float(fit[1])]}, open(f"{out_dir}/student_{V}_{d}.json", "w"))

json.dump(results, open(f"{out_dir}/results_{int(time.time())}.json", "w"), ensure_ascii=False, indent=1)
