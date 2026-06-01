# -*- coding: utf-8 -*-
"""Independent SymPy verification of CramBox answers — v2.
Keyed by (topic, position-in-topic) so there is NO global-index drift.
Each EXPECTED value is computed/encoded fresh, then compared to the stored answer."""
import json, re, subprocess, html
import sympy as sp
from sympy import sqrt, Rational, symbols, solve, factor, Eq, Matrix, sin, tan, rad, divisors
import statistics as st

x, y, a, b, n = symbols('x y a b n')

NODE = r'''
const fs=require('fs');let h=fs.readFileSync('index.html','utf8');
let s=h.indexOf('const DATA = {');let bb=h.slice(s+'const DATA = '.length);
let d=0,e=-1;for(let i=0;i<bb.length;i++){const c=bb[i];if(c==='{')d++;else if(c==='}'){d--;if(d===0){e=i;break;}}}
const DATA=eval('('+bb.slice(0,e+1)+')');
let out=[],g=0;DATA.maths.topics.forEach(t=>(t.practice||[]).forEach((p,qi)=>{
  g++; out.push({g,topic:t.title,qi,type:p.type,ans:(p.type==='mcq'?String(p.opts[p.ans]):String(p.ans))});
}));process.stdout.write(JSON.stringify(out));
'''
Q = json.loads(subprocess.run(['node','-e',NODE],capture_output=True,text=True,encoding='utf-8').stdout)

SUP = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹⁻','0123456789-')
def to_expr(s):
    s = html.unescape(str(s))
    # superscripts -> **n   (e.g. x⁴ -> x**4, 10⁻³ -> 10**-3)
    s = re.sub(r'([0-9a-zA-Z\)])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)', lambda m: m.group(1)+'**'+m.group(2).translate(SUP), s)
    s = s.replace('√','sqrt').replace('×','*').replace(' x 10','*10').replace('x10','*10')
    s = re.sub(r'(cm3|cm2|cm|m/s|°|\$|%|,)','',s)
    if '=' in s: s = s.split('=')[-1]
    s = s.replace(')(',')*(').strip()
    s = re.sub(r'(\d)([a-zA-Z\(])', r'\1*\2', s)   # implicit mult: 12x -> 12*x, 3( -> 3*(
    return sp.sympify(s, locals={'x':x,'y':y,'a':a,'b':b,'n':n})

def ints(s):
    return [int(z) for z in re.findall(r'-?\d+', html.unescape(str(s)))]

def norm(s):
    return re.sub(r'\s','', html.unescape(str(s)).lower())

def compare(expected, stored):
    # tuple -> coordinate; list -> set of roots; str -> word/relation; else numeric/symbolic
    if isinstance(expected, tuple):
        return ints(stored) == list(expected)
    if isinstance(expected, list):
        return sorted(ints(stored)) == sorted(expected)
    if isinstance(expected, str):
        return norm(stored) == norm(expected)
    try:
        cs = to_expr(stored)
        if abs(float(sp.N(cs)) - float(sp.N(expected))) < 1e-6: return True
    except Exception: pass
    try:
        if sp.simplify(sp.expand(to_expr(stored)) - sp.expand(expected)) == 0: return True
    except Exception: pass
    return False

yv = symbols('y'); tt,uu,vv,aa = symbols('t u v a'); P,l,w = symbols('P l w')
# EXPECTED answers, independently derived, keyed by (topic, position-in-topic 0-based)
E = {
 ('Solving Linear Equations',0): solve(Eq(5*x-3,17),x)[0], ('Solving Linear Equations',1): solve(Eq(2*yv+9,25),yv)[0],
 ('Solving Linear Equations',2): solve(Eq(4*x+5,2*x+13),x)[0], ('Solving Linear Equations',3): solve(Eq(7*x-14,0),x)[0],
 ('Simultaneous Equations',0): solve([Eq(a+b,10),Eq(a-b,4)])[a], ('Simultaneous Equations',1): solve([Eq(a+b,10),Eq(a-b,4)])[b],
 ('Simultaneous Equations',2): solve([Eq(3*a+2*b,12),Eq(a+2*b,8)])[a],
 ('Area and Perimeter',0): 15*8, ('Area and Perimeter',1): Rational(1,2)*10*7, ('Area and Perimeter',2): 2*Rational(22,7)*14, ('Area and Perimeter',3): Rational(36,4)**2,
 ('Fractions and Percentages',0): Rational(2,5)*100, ('Fractions and Percentages',1): Rational(25,100)*160, ('Fractions and Percentages',2): 80-Rational(15,100)*80, ('Fractions and Percentages',3): Rational(45,75)*100,
 ('Mean, Median and Mode',0): Rational(6+4+8+10+2,5), ('Mean, Median and Mode',1): sorted([3,7,1,9,5])[2], ('Mean, Median and Mode',2): st.mode([2,4,4,6,4,8,6]), ('Mean, Median and Mode',3): Rational(20+30,2),
 ('Factorising Quadratics',0): factor(yv**2+10*yv-24), ('Factorising Quadratics',1): factor(x**2+5*x+6), ('Factorising Quadratics',2): factor(x**2-49), ('Factorising Quadratics',3): min(solve(x**2-5*x+6,x)),
 ('Indices (Index Laws)',0): 2**3*2**2, ('Indices (Index Laws)',1): sp.simplify(x**6/x**2), ('Indices (Index Laws)',2): 7**0, ('Indices (Index Laws)',3): Rational(1,8),
 ('Matrices',0): Matrix([[2,3],[1,4]]).det(), ('Matrices',1): Matrix([[1,2],[3,4]]).det(), ('Matrices',2): (Matrix([[2,1],[0,3]])*Matrix([1,2]))[0], ('Matrices',3): 'no',
 ('Sets and Venn Diagrams',0): len(divisors(42)), ('Sets and Venn Diagrams',1): 12+15-5, ('Sets and Venn Diagrams',2): 30-22, ('Sets and Venn Diagrams',3): 'BOTH A and B',
 ('Trigonometry (Right-Angled)',0): sqrt(6**2+8**2), ('Trigonometry (Right-Angled)',1): sin(rad(30)), ('Trigonometry (Right-Angled)',2): 10*sin(rad(30)), ('Trigonometry (Right-Angled)',3): tan(rad(45)),
 ('Volume and Surface Area',0): sqrt(10**2-8**2), ('Volume and Surface Area',1): Rational(22,7)*7**2*10, ('Volume and Surface Area',2): 4*Rational(22,7)*7**2, ('Volume and Surface Area',3): 'h',
 ('Variation',0): Rational(10,2), ('Variation',1): 3*7, ('Variation',2): Rational(8*3,4), ('Variation',3): 2,
 ('Standard Form',0): 36000, ('Standard Form',1): Rational(45,10000), ('Standard Form',2): 8*10**7, ('Standard Form',3): 5200,
 ('Number Bases',0): int('1101',2), ('Number Bases',1): int(format(6,'b')), ('Number Bases',2): int('1010',2), ('Number Bases',3): 2**3,
 ('Ratio, Rate and Proportion',0): '3:5', ('Ratio, Rate and Proportion',1): 80*Rational(5,8), ('Ratio, Rate and Proportion',2): Rational(150,3), ('Ratio, Rate and Proportion',3): Rational(12,4)*7,
 ('Approximation and Accuracy',0): 4600, ('Approximation and Accuracy',1): 0.058, ('Approximation and Accuracy',2): 3.9, ('Approximation and Accuracy',3): 30*5,
 ('Financial Mathematics',0): Rational(20,80)*100, ('Financial Mathematics',1): Rational(600*5*3,100), ('Financial Mathematics',2): 2000*Rational(11,10)**2, ('Financial Mathematics',3): 200*Rational(85,100),
 ('Expanding and Simplifying',0): sp.expand(4*(3*x-2)), ('Expanding and Simplifying',1): sp.expand((x+4)*(x+5)), ('Expanding and Simplifying',2): sp.simplify(7*a+3-2*a+5), ('Expanding and Simplifying',3): sp.expand((x+3)*(x-3)).coeff(x,0),
 ('Algebraic Fractions',0): sp.together(x/3+x/4), ('Algebraic Fractions',1): sp.simplify(6*x/9), ('Algebraic Fractions',2): sp.expand(sp.numer(sp.together((2*x-1)/4-(3*x-5)/12))), ('Algebraic Fractions',3): sp.simplify(5*x/2+3*x/2),
 ('Change of Subject',0): solve(Eq(yv,3*x+2),x)[0], ('Change of Subject',1): solve(Eq(vv,uu+aa*tt),tt)[0], ('Change of Subject',2): solve(Eq(P,2*(l+w)),w)[0], ('Change of Subject',3): 'square root',
 ('Quadratic Formula',0): 2, ('Quadratic Formula',1): (-5)**2-4*1*6, ('Quadratic Formula',2): max(solve(x**2+3*x-4,x)), ('Quadratic Formula',3): sorted(solve(x**2-7*x+12,x)),
 ('Inequalities and Linear Programming',0): 'x>2', ('Inequalities and Linear Programming',1): 'x<-3', ('Inequalities and Linear Programming',2): 'x<=3', ('Inequalities and Linear Programming',3): 5,
 ('Functions and Sequences',0): 2*4+3, ('Functions and Sequences',1): 3**2-1, ('Functions and Sequences',2): '3n+2', ('Functions and Sequences',3): 2*10,
 ('Angles and Polygons',0): 180-50, ('Angles and Polygons',1): (6-2)*180, ('Angles and Polygons',2): 360//5, ('Angles and Polygons',3): 180-60-70,
 ('Bearings',0): 90, ('Bearings',1): 70+180, ('Bearings',2): 180, ('Bearings',3): 'South-East',
 ('Circle Theorems',0): 2*40, ('Circle Theorems',1): 90, ('Circle Theorems',2): 180-110, ('Circle Theorems',3): 140//2,
 ('Similarity and Congruence',0): 5*3, ('Similarity and Congruence',1): 2**2, ('Similarity and Congruence',2): 'same shape AND size', ('Similarity and Congruence',3): 6*Rational(6,4),
 ('Constructions and Loci',0): 'perpendicular bisector', ('Constructions and Loci',1): 'circle', ('Constructions and Loci',2): 'lines', ('Constructions and Loci',3): 'compasses',
 ('Sine and Cosine Rule',0): Rational(1,2)*6*8*sin(rad(30)), ('Sine and Cosine Rule',1): sqrt(3**2+4**2), ('Sine and Cosine Rule',2): 'Cosine rule', ('Sine and Cosine Rule',3): Rational(1,2)*10*4*sin(rad(90)),
 ('Probability',0): Rational(1,6), ('Probability',1): Rational(3,10), ('Probability',2): 1-Rational(3,10), ('Probability',3): Rational(1,2)*Rational(1,2),
 ('Statistical Graphs',0): Rational(8,40)*360, ('Statistical Graphs',1): 360, ('Statistical Graphs',2): Rational(90,360), ('Statistical Graphs',3): Rational(10,30)*360,
 ('Cumulative Frequency',0): 'total', ('Cumulative Frequency',1): 5+12, ('Cumulative Frequency',2): 80//2, ('Cumulative Frequency',3): 'Q1',
 ('Coordinate Geometry',0): Rational(8-2,4-1), ('Coordinate Geometry',1): (4,6), ('Coordinate Geometry',2): 3, ('Coordinate Geometry',3): 'the y-intercept',
 ('Functional Graphs',0): 'a parabola', ('Functional Graphs',1): 'minimum', ('Functional Graphs',2): 'x-axis', ('Functional Graphs',3): Rational(1,2)*3*(5-3),
 ('Travel Graphs',0): 'speed', ('Travel Graphs',1): Rational(150,30), ('Travel Graphs',2): 'stationary', ('Travel Graphs',3): 'distance',
 ('Vectors',0): sqrt(3**2+4**2), ('Vectors',1): 2+3, ('Vectors',2): sqrt(17**2-8**2), ('Vectors',3): sqrt(6**2+8**2),
 ('Transformations',0): (3,-2), ('Transformations',1): (4,3), ('Transformations',2): (-2,-5), ('Transformations',3): (-4,1),
}
# definitional (no maths to compute) — verified by human via answer key, not by SymPy
DEFINITIONAL = {('Matrices',3),('Sets and Venn Diagrams',3),('Volume and Surface Area',3),('Change of Subject',3),
 ('Bearings',3),('Similarity and Congruence',2),('Constructions and Loci',0),('Constructions and Loci',1),
 ('Constructions and Loci',2),('Constructions and Loci',3),('Sine and Cosine Rule',2),('Cumulative Frequency',0),
 ('Cumulative Frequency',3),('Coordinate Geometry',3),('Functional Graphs',0),('Functional Graphs',1),
 ('Functional Graphs',2),('Travel Graphs',0),('Travel Graphs',2),('Travel Graphs',3),('Functions and Sequences',2)}

P_, M_, D_ = [], [], []
for it in Q:
    key=(it['topic'],it['qi'])
    if key in DEFINITIONAL: D_.append(it); continue
    if key not in E: D_.append(it); continue
    (P_ if compare(E[key], it['ans']) else M_).append((it, str(E[key])))

print('============ INDEPENDENT SYMPY VERIFICATION (v2) ============')
print(f"Total questions      : {len(Q)}")
print(f"MACHINE-VERIFIED PASS : {len(P_)}")
print(f"MISMATCH (real error?): {len(M_)}")
print(f"Definitional (human)  : {len(D_)}")
print()
if M_:
    print('---- MISMATCHES TO INVESTIGATE ----')
    for it,exp in M_:
        print(f"  Q{it['g']} [{it['topic']}]  stored='{it['ans']}'   sympy_expected='{exp}'")
else:
    print('>>> Zero mismatches. Every machine-checkable answer matches an independent SymPy computation. <<<')
print()
print(f'---- {len(D_)} DEFINITIONAL (check on the printed answer key) ----')
for it in D_:
    print(f"  Q{it['g']} [{it['topic']}]  ans='{html.unescape(it['ans'])}'")
