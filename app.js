/* Bill Maker — vanilla JS */

let items   = [];
let adjs    = [];
let itemSeq = 0, adjSeq = 0;

const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const num = v => parseFloat(v) || 0;

// ── Theme ─────────────────────────────────
(function () { if (localStorage.getItem('bm-theme') === 'light') document.body.classList.add('light'); })();
$('themeToggle').addEventListener('click', function () {
  document.body.classList.toggle('light');
  localStorage.setItem('bm-theme', document.body.classList.contains('light') ? 'light' : 'dark');
});

// ── Invoice Number ────────────────────────
function nextInvoiceNo() {
  var n = parseInt(localStorage.getItem('bm-inv-seq') || '0') + 1;
  localStorage.setItem('bm-inv-seq', String(n));
  return String(n);
}

// ── Amount in Words (Indian) ──────────────
function amountInWords(n) {
  if (n === 0) return 'Zero Only';
  var neg = n < 0; if (neg) n = -n;
  var rupees = Math.floor(n);
  var paise = Math.round((n - rupees) * 100);

  var ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  var tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  function twoDigit(x) {
    if (x < 20) return ones[x];
    return tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
  }
  function threeDigit(x) {
    if (x >= 100) return ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' and ' + twoDigit(x%100) : '');
    return twoDigit(x);
  }

  var parts = [], r = rupees;
  if (r >= 10000000) { parts.push(twoDigit(Math.floor(r/10000000)) + ' Crore'); r %= 10000000; }
  if (r >= 100000)   { parts.push(twoDigit(Math.floor(r/100000)) + ' Lakh'); r %= 100000; }
  if (r >= 1000)     { parts.push(twoDigit(Math.floor(r/1000)) + ' Thousand'); r %= 1000; }
  if (r > 0)         { parts.push(threeDigit(r)); }

  var w = (neg ? 'Minus ' : '') + 'INR ' + (parts.join(' ') || 'Zero');
  if (paise > 0) w += ' and ' + twoDigit(paise) + ' Paise';
  return w + ' Only';
}

// ── Computed fields ───────────────────────
function itemQty(it)    { return num(it.wgt) - num(it.lessWgt); }
function itemAmount(it) { return itemQty(it) * num(it.rate); }

function computeSteps() {
  var subtotal = items.reduce(function (s, i) { return s + itemAmount(i); }, 0);
  var running = subtotal;
  var steps = adjs.map(function (a) {
    var v = num(a.value), next = running;
    if      (a.operation === '+') next = running + v;
    else if (a.operation === '-') next = running - v;
    else if (a.operation === '*') next = running * v;
    else if (a.operation === '/') next = v !== 0 ? running / v : running;
    running = next;
    return { label: a.label, value: next };
  });
  return { subtotal: subtotal, steps: steps, finalVal: running };
}

function refreshCalc() {
  var c = computeSteps();
  $('subtotalDisplay').textContent = '₹ ' + fmt(c.subtotal);
  $('finalValue').textContent      = '₹ ' + fmt(c.finalVal);
  $('amtWordsText').textContent    = amountInWords(c.finalVal);

  items.forEach(function (it) {
    var qEl = document.querySelector('.qty-cell[data-id="'+it.id+'"]');
    var aEl = document.querySelector('.amt-cell[data-id="'+it.id+'"]');
    if (qEl) qEl.textContent = fmt(itemQty(it));
    if (aEl) aEl.textContent = fmt(itemAmount(it));
  });
  adjs.forEach(function (a, i) {
    var el = document.querySelector('.result-cell[data-id="'+a.id+'"]');
    if (el) el.textContent = '₹ ' + fmt(c.steps[i] ? c.steps[i].value : 0);
  });

  // running totals footer
  var tB=0,tW=0,tL=0,tQ=0,tA=0;
  items.forEach(function(it){ tB+=num(it.bags); tW+=num(it.wgt); tL+=num(it.lessWgt); tQ+=itemQty(it); tA+=itemAmount(it); });
  $('footBags').textContent = tB;
  $('footWgt').textContent  = fmt(tW);
  $('footLess').textContent = fmt(tL);
  $('footQty').textContent  = fmt(tQ);
  $('footAmt').textContent  = fmt(tA);
}

// ── Render Items ──────────────────────────
function renderItems() {
  var tbody = $('itemsBody');
  tbody.innerHTML = '';
  items.forEach(function (it) {
    var tr = document.createElement('tr');
    var h = '';
    h += '<td data-label="Description"><input type="text" class="f-desc" data-id="'+it.id+'" value="'+esc(it.desc)+'" placeholder="e.g. PVC"></td>';
    h += '<td data-label="Bags" class="c-bags"><input type="number" class="f-bags" data-id="'+it.id+'" value="'+(it.bags||'')+'" step="1" min="0" placeholder="0"></td>';
    h += '<td data-label="Wgt" class="c-wgt"><input type="number" class="f-wgt" data-id="'+it.id+'" value="'+(it.wgt||'')+'" step="0.01" min="0" placeholder="0"></td>';
    h += '<td data-label="Less Wgt" class="c-less"><input type="number" class="f-less" data-id="'+it.id+'" value="'+(it.lessWgt||'')+'" step="0.01" min="0" placeholder="0"></td>';
    h += '<td data-label="Qty (kgs)" class="computed-cell qty-cell" data-id="'+it.id+'">'+fmt(itemQty(it))+'</td>';
    h += '<td data-label="Rate" class="c-rate"><input type="number" class="f-rate" data-id="'+it.id+'" value="'+(it.rate||'')+'" step="0.01" min="0" placeholder="0"></td>';
    h += '<td data-label="Amount" class="computed-cell amt amt-cell" data-id="'+it.id+'">'+fmt(itemAmount(it))+'</td>';
    h += '<td class="c-rm mob-rm"><button class="btn-icon remove-item" data-id="'+it.id+'" title="Remove">&times;</button></td>';
    tr.innerHTML = h;
    tbody.appendChild(tr);
  });
  refreshCalc();
}

function renderAdjs() {
  var tbody = $('adjBody');
  tbody.innerHTML = '';
  var st = computeSteps().steps;
  adjs.forEach(function (adj, i) {
    var rv = st[i] ? st[i].value : 0;
    var tr = document.createElement('tr');
    var h = '';
    h += '<td data-label="Label"><input type="text" class="adj-label" data-id="'+adj.id+'" value="'+esc(adj.label)+'" placeholder="e.g. GST 18%"></td>';
    h += '<td data-label="Operation" class="col-op"><select class="adj-op" data-id="'+adj.id+'">';
    h += '<option value="+"'+(adj.operation==='+'?' selected':'')+'>+ Add</option>';
    h += '<option value="-"'+(adj.operation==='-'?' selected':'')+'>− Sub</option>';
    h += '<option value="*"'+(adj.operation==='*'?' selected':'')+'>× Mul</option>';
    h += '<option value="/"'+(adj.operation==='/'?' selected':'')+'>÷ Div</option>';
    h += '</select></td>';
    h += '<td data-label="Value" class="col-num"><input type="number" class="adj-value" data-id="'+adj.id+'" value="'+adj.value+'" step="0.01" placeholder="0"></td>';
    h += '<td data-label="Result" class="result-cell" data-id="'+adj.id+'">₹ '+fmt(rv)+'</td>';
    h += '<td class="col-rm adj-mob-rm"><button class="btn-icon remove-adj" data-id="'+adj.id+'" title="Remove">&times;</button></td>';
    tr.innerHTML = h;
    tbody.appendChild(tr);
  });
  refreshCalc();
}

// ── Add / Remove ──────────────────────────
function addItem()  { items.push({ id: ++itemSeq, desc:'', bags:'', wgt:'', lessWgt:'', rate:'' }); renderItems(); }
function addAdj()   { adjs.push({ id: ++adjSeq, label:'', operation:'+', value:'' }); renderAdjs(); }
function rmItem(id) { items = items.filter(function(i){return i.id!==id}); renderItems(); }
function rmAdj(id)  { adjs = adjs.filter(function(a){return a.id!==id}); renderAdjs(); }

// ── Events: Items ─────────────────────────
$('itemsBody').addEventListener('input', function (e) {
  var el = e.target, id = parseInt(el.dataset.id);
  var it = items.find(function(i){return i.id===id});
  if (!it) return;
  if (el.classList.contains('f-desc')) it.desc = el.value;
  if (el.classList.contains('f-bags')) it.bags = el.value;
  if (el.classList.contains('f-wgt'))  it.wgt = el.value;
  if (el.classList.contains('f-less')) it.lessWgt = el.value;
  if (el.classList.contains('f-rate')) it.rate = el.value;
  refreshCalc();
});
$('itemsBody').addEventListener('click', function (e) {
  if (e.target.classList.contains('remove-item')) rmItem(parseInt(e.target.dataset.id));
});

// ── Events: Adjustments ───────────────────
$('adjBody').addEventListener('input', function (e) {
  var el = e.target, id = parseInt(el.dataset.id);
  var adj = adjs.find(function(a){return a.id===id});
  if (!adj) return;
  if (el.classList.contains('adj-label')) adj.label = el.value;
  if (el.classList.contains('adj-value')) adj.value = el.value;
  refreshCalc();
});
$('adjBody').addEventListener('change', function (e) {
  if (e.target.classList.contains('adj-op')) {
    var adj = adjs.find(function(a){return a.id===parseInt(e.target.dataset.id)});
    if (adj) { adj.operation = e.target.value; refreshCalc(); }
  }
});
$('adjBody').addEventListener('click', function (e) {
  if (e.target.classList.contains('remove-adj')) rmAdj(parseInt(e.target.dataset.id));
});

$('addItem').addEventListener('click', addItem);
$('addAdj').addEventListener('click', addAdj);
$('finalTag').addEventListener('input', function () {
  $('finalTagDisplay').textContent = $('finalTag').value || 'Total Amount Payable';
});
$('clearBtn').addEventListener('click', function () {
  if (!confirm('Clear all fields?')) return;
  items = []; adjs = []; itemSeq = 0; adjSeq = 0;
  $('companyName').value = 'Sri Karani Plastics'; $('ownerName').value = 'Mahendra Singh Chowdary';
  $('billDate').value = today(); $('customerName').value = '';
  $('invoiceNo').value = '';
  $('finalTag').value = 'Total Amount Payable';
  $('finalTagDisplay').textContent = 'Total Amount Payable';
  renderItems(); renderAdjs();
});

// ── Save & Load Bills ─────────────────────
function getBillData() {
  return {
    invoiceNo: $('invoiceNo').value,
    company:   $('companyName').value,
    owner:     $('ownerName').value,
    date:      $('billDate').value,
    customer:  $('customerName').value,
    ftag:      $('finalTag').value,
    items:     items.map(function(it){ return { desc:it.desc, bags:it.bags, wgt:it.wgt, lessWgt:it.lessWgt, rate:it.rate }; }),
    adjs:      adjs.map(function(a){ return { label:a.label, operation:a.operation, value:a.value }; })
  };
}

function loadBillData(bd) {
  $('invoiceNo').value   = bd.invoiceNo || '';
  $('companyName').value = bd.company   || '';
  $('ownerName').value   = bd.owner     || '';
  $('billDate').value    = bd.date      || today();
  $('customerName').value= bd.customer  || '';
  $('finalTag').value    = bd.ftag      || 'Total Amount Payable';
  $('finalTagDisplay').textContent = bd.ftag || 'Total Amount Payable';

  items = []; itemSeq = 0;
  (bd.items || []).forEach(function(it) {
    items.push({ id: ++itemSeq, desc:it.desc||'', bags:it.bags||'', wgt:it.wgt||'', lessWgt:it.lessWgt||'', rate:it.rate||'' });
  });
  adjs = []; adjSeq = 0;
  (bd.adjs || []).forEach(function(a) {
    adjs.push({ id: ++adjSeq, label:a.label||'', operation:a.operation||'+', value:a.value||'' });
  });
  renderItems(); renderAdjs();
}

function getSavedBills() {
  try { return JSON.parse(localStorage.getItem('bm-bills') || '[]'); }
  catch(e) { return []; }
}
function setSavedBills(arr) { localStorage.setItem('bm-bills', JSON.stringify(arr)); }

$('saveBtn').addEventListener('click', function () {
  var bd = getBillData();
  if (!bd.invoiceNo) bd.invoiceNo = nextInvoiceNo();
  $('invoiceNo').value = bd.invoiceNo;

  var c = computeSteps();
  var entry = {
    id: Date.now(),
    invoiceNo: bd.invoiceNo,
    customer:  bd.customer || '—',
    date:      bd.date,
    total:     c.finalVal,
    data:      bd
  };

  var bills = getSavedBills();
  bills.unshift(entry);
  setSavedBills(bills);
  renderHistory();
  alert('Bill #' + bd.invoiceNo + ' saved!');
});

// ── History Panel ─────────────────────────
function renderHistory() {
  var bills = getSavedBills();
  var hCard = $('historyCard');
  var list  = $('historyList');
  var empty = $('historyEmpty');

  if (bills.length === 0) {
    empty.style.display = '';
    list.innerHTML = '';
  } else {
    empty.style.display = 'none';
    var h = '';
    bills.forEach(function(b) {
      h += '<div class="hist-row" data-id="'+b.id+'">';
      h += '<div class="hist-info">';
      h += '<strong>#'+esc(b.invoiceNo)+'</strong>';
      h += '<span class="hist-cust">'+esc(b.customer)+'</span>';
      h += '<span class="hist-date">'+fmtDate(b.date)+'</span>';
      h += '</div>';
      h += '<div class="hist-amt">₹ '+fmt(b.total)+'</div>';
      h += '<div class="hist-actions">';
      h += '<button class="btn btn-ghost btn-sm hist-load" data-id="'+b.id+'" title="Load">Load</button>';
      h += '<button class="btn btn-ghost btn-sm hist-dup" data-id="'+b.id+'" title="Duplicate">Dup</button>';
      h += '<button class="btn btn-ghost btn-sm hist-del" data-id="'+b.id+'" title="Delete">Del</button>';
      h += '</div></div>';
    });
    list.innerHTML = h;
  }
}

$('historyBtn').addEventListener('click', function () {
  var hCard = $('historyCard');
  if (hCard.style.display === 'none') {
    hCard.style.display = '';
    renderHistory();
  } else {
    hCard.style.display = 'none';
  }
});
$('toggleHistory').addEventListener('click', function () {
  $('historyCard').style.display = 'none';
});

$('historyList').addEventListener('click', function (e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  var id = parseInt(btn.dataset.id);
  var bills = getSavedBills();
  var bill = bills.find(function(b){ return b.id === id; });
  if (!bill) return;

  if (btn.classList.contains('hist-load')) {
    loadBillData(bill.data);
  } else if (btn.classList.contains('hist-dup')) {
    var bd = JSON.parse(JSON.stringify(bill.data));
    bd.invoiceNo = nextInvoiceNo();
    bd.date = today();
    loadBillData(bd);
  } else if (btn.classList.contains('hist-del')) {
    if (!confirm('Delete bill #' + bill.invoiceNo + '?')) return;
    bills = bills.filter(function(b){ return b.id !== id; });
    setSavedBills(bills);
    renderHistory();
  }
});

// ── Helpers ───────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  var p = iso.split('-');
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return parseInt(p[2])+' '+months[parseInt(p[1])-1]+' '+p[0];
}
function getFormData() {
  return {
    invoiceNo: $('invoiceNo').value.trim() || '',
    company:   $('companyName').value.trim()||'Company Name',
    owner:     $('ownerName').value.trim()||'—',
    date:      $('billDate').value||today(),
    customer:  $('customerName').value.trim()||'—',
    ftag:      $('finalTag').value.trim()||'Total Amount Payable'
  };
}

// ── PDF (plain receipt) ───────────────────
$('downloadPdfBtn').addEventListener('click', generatePDF);

function generatePDF() {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF('landscape','mm','a4');
  var d = getFormData(), c = computeSteps();
  var PW = 297, M = 12, R = PW - M;
  var y = M;

  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(M,y,R,y); y += 7;
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(0);
  doc.text(d.company, PW/2, y, {align:'center'}); y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(8);
  doc.text('Prop: '+d.owner+'  |  Plastic Scrap Dealer', PW/2, y, {align:'center'}); y += 4;
  doc.setLineWidth(0.3); doc.line(M,y,R,y); y += 6;

  doc.setFontSize(9);
  var invLabel = 'Invoice' + (d.invoiceNo ? ' #'+d.invoiceNo : '');
  doc.text(invLabel, M, y);
  doc.text('Date: '+fmtDate(d.date), R, y, {align:'right'}); y += 5;
  doc.setFontSize(8); doc.text('Bill to:', M, y);
  doc.setFontSize(9); doc.text(d.customer, M+15, y); y += 6;
  doc.setLineWidth(0.2); doc.line(M,y,R,y); y += 2;

  var rows = items.map(function(it,idx){
    return [String(idx+1), it.desc||'—', String(num(it.bags)), fmt(num(it.wgt)), fmt(num(it.lessWgt)), fmt(itemQty(it))+' kgs', fmt(num(it.rate)), fmt(itemAmount(it))];
  });
  var tB=0,tW=0,tL=0,tQ=0,tA=0;
  items.forEach(function(it){ tB+=num(it.bags); tW+=num(it.wgt); tL+=num(it.lessWgt); tQ+=itemQty(it); tA+=itemAmount(it); });
  rows.push(['','Total', String(tB), fmt(tW), fmt(tL), fmt(tQ)+' kgs', '', fmt(tA)]);

  doc.autoTable({
    startY:y, margin:{left:M,right:M},
    head:[['Sl','Description of Goods','Bags','Wgt','Less Wgt','Quantity','Rate','Amount']],
    body:rows, theme:'plain',
    styles:{ font:'helvetica',fontSize:8,cellPadding:{top:2,right:2,bottom:2,left:2}, textColor:[0,0,0],lineColor:[0,0,0],lineWidth:0.15,valign:'middle',fontStyle:'normal' },
    headStyles:{ fillColor:false,textColor:[0,0,0],fontStyle:'normal',fontSize:7.5 },
    bodyStyles:{ fillColor:false },
    columnStyles:{
      0:{halign:'center',cellWidth:8}, 1:{halign:'left'},
      2:{halign:'center',cellWidth:14}, 3:{halign:'right',cellWidth:20},
      4:{halign:'right',cellWidth:20}, 5:{halign:'right',cellWidth:28},
      6:{halign:'right',cellWidth:18}, 7:{halign:'right',cellWidth:28}
    },
    didDrawPage:function(data){
      var hd=data.table.head;
      if(hd.length){doc.setDrawColor(0);doc.setLineWidth(0.3);doc.line(M,hd[0].y,R,hd[0].y);doc.line(M,hd[0].y+hd[0].height,R,hd[0].y+hd[0].height);}
    },
    didDrawCell:function(data){
      if(data.section==='body'){doc.setDrawColor(0);doc.setLineWidth(0.1);doc.line(M,data.cell.y+data.cell.height,R,data.cell.y+data.cell.height);}
      if(data.section==='body'&&data.row.index===rows.length-1){
        doc.setDrawColor(0);doc.setLineWidth(0.3);doc.line(M,data.cell.y,R,data.cell.y);
      }
    }
  });
  y = doc.lastAutoTable.finalY + 2;
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(M,y,R,y); y += 6;

  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(0);
  doc.text('Subtotal', R-38, y, {align:'right'});
  doc.text('Rs. '+fmt(c.subtotal), R, y, {align:'right'}); y += 5;

  if (adjs.length) {
    var opSym={'+':'+','-':'−','*':'×','/':'÷'};
    adjs.forEach(function(a,i){
      var v=num(a.value), res=c.steps[i]?c.steps[i].value:0;
      var tag=a.label||('Adj. '+(i+1));
      doc.text(tag+' ('+(opSym[a.operation]||'')+' '+fmt(v)+')', M, y);
      doc.text('Rs. '+fmt(res), R, y, {align:'right'}); y+=5;
    }); y+=1;
  }

  doc.setLineWidth(0.3); doc.line(M,y,R,y); y+=5;
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text(d.ftag, M, y); doc.text('Rs. '+fmt(c.finalVal), R, y, {align:'right'}); y+=3;
  doc.setLineWidth(0.3); doc.line(M,y,R,y); y+=5;

  // amount in words
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0);
  doc.text('Amount Chargeable (in words):', M, y); y+=4;
  doc.setFont('helvetica','italic'); doc.setFontSize(8);
  doc.text(amountInWords(c.finalVal), M, y); y+=10;

  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(120,120,120);
  doc.text('Computer generated invoice  |  '+fmtDate(today()), PW/2, y, {align:'center'});

  doc.save('Invoice_'+(d.invoiceNo||'draft')+'_'+d.date+'.pdf');
}

// ── JPG (plain receipt) ───────────────────
$('downloadJpgBtn').addEventListener('click', function(){ generateJPG('download'); });

function generateJPG(mode) {
  var d = getFormData(), c = computeSteps();
  var el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px;padding:30px 40px;background:#fff;font-family:Helvetica,Arial,sans-serif;color:#000;font-size:12px;';

  var tB=0,tW=0,tL=0,tQ=0,tA=0;
  items.forEach(function(it){ tB+=num(it.bags); tW+=num(it.wgt); tL+=num(it.lessWgt); tQ+=itemQty(it); tA+=itemAmount(it); });

  var h = '';
  h += '<div style="border-top:1px solid #000;margin-bottom:12px;"></div>';
  h += '<div style="text-align:center;font-size:16px;font-weight:bold;margin-bottom:2px;">'+esc(d.company)+'</div>';
  h += '<div style="text-align:center;font-size:9px;margin-bottom:8px;">Prop: '+esc(d.owner)+'  |  Plastic Scrap Dealer</div>';
  h += '<div style="border-top:1px solid #000;margin-bottom:10px;"></div>';

  var invLabel = 'Invoice' + (d.invoiceNo ? ' #'+d.invoiceNo : '');
  h += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span>'+invLabel+'</span><span>Date: '+fmtDate(d.date)+'</span></div>';
  h += '<div style="font-size:11px;margin-bottom:8px;">Bill to: '+esc(d.customer)+'</div>';
  h += '<div style="border-top:1px solid #999;margin-bottom:4px;"></div>';

  h += '<table style="width:100%;border-collapse:collapse;margin-bottom:2px;">';
  h += '<tr style="font-size:9px;border-bottom:1px solid #000;">';
  h += '<td style="padding:3px;width:24px;text-align:center;">Sl</td>';
  h += '<td style="padding:3px;">Description of Goods</td>';
  h += '<td style="padding:3px;width:40px;text-align:center;">Bags</td>';
  h += '<td style="padding:3px;width:55px;text-align:right;">Wgt</td>';
  h += '<td style="padding:3px;width:60px;text-align:right;">Less Wgt</td>';
  h += '<td style="padding:3px;width:80px;text-align:right;">Quantity</td>';
  h += '<td style="padding:3px;width:55px;text-align:right;">Rate</td>';
  h += '<td style="padding:3px;width:80px;text-align:right;">Amount</td>';
  h += '</tr>';
  items.forEach(function(it,idx){
    h += '<tr style="font-size:11px;border-bottom:1px solid #ddd;">';
    h += '<td style="padding:3px;text-align:center;">'+(idx+1)+'</td>';
    h += '<td style="padding:3px;">'+esc(it.desc||'—')+'</td>';
    h += '<td style="padding:3px;text-align:center;">'+(num(it.bags)||'')+'</td>';
    h += '<td style="padding:3px;text-align:right;">'+fmt(num(it.wgt))+'</td>';
    h += '<td style="padding:3px;text-align:right;">'+fmt(num(it.lessWgt))+'</td>';
    h += '<td style="padding:3px;text-align:right;">'+fmt(itemQty(it))+' kgs</td>';
    h += '<td style="padding:3px;text-align:right;">'+fmt(num(it.rate))+'</td>';
    h += '<td style="padding:3px;text-align:right;">'+fmt(itemAmount(it))+'</td>';
    h += '</tr>';
  });
  h += '<tr style="font-size:11px;border-top:1px solid #000;font-weight:bold;">';
  h += '<td style="padding:3px;"></td><td style="padding:3px;">Total</td>';
  h += '<td style="padding:3px;text-align:center;">'+tB+'</td>';
  h += '<td style="padding:3px;text-align:right;">'+fmt(tW)+'</td>';
  h += '<td style="padding:3px;text-align:right;">'+fmt(tL)+'</td>';
  h += '<td style="padding:3px;text-align:right;">'+fmt(tQ)+' kgs</td>';
  h += '<td style="padding:3px;"></td>';
  h += '<td style="padding:3px;text-align:right;">'+fmt(tA)+'</td>';
  h += '</tr></table>';
  h += '<div style="border-top:1px solid #000;margin-bottom:6px;"></div>';

  h += '<div style="display:flex;justify-content:flex-end;font-size:11px;margin-bottom:3px;"><span style="margin-right:14px;">Subtotal</span><span>Rs. '+fmt(c.subtotal)+'</span></div>';

  if (adjs.length) {
    var opSym={'+':'+','-':'−','*':'×','/':'÷'};
    adjs.forEach(function(a,i){
      var v=num(a.value), res=c.steps[i]?c.steps[i].value:0, tag=a.label||('Adj. '+(i+1));
      h += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;">';
      h += '<span>'+esc(tag)+' ('+(opSym[a.operation]||'')+' '+fmt(v)+')</span><span>Rs. '+fmt(res)+'</span></div>';
    });
  }

  h += '<div style="border-top:1px solid #000;margin-top:6px;margin-bottom:4px;"></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold;margin-bottom:3px;">';
  h += '<span>'+esc(d.ftag)+'</span><span>Rs. '+fmt(c.finalVal)+'</span></div>';
  h += '<div style="border-top:1px solid #000;margin-bottom:6px;"></div>';

  h += '<div style="font-size:9px;margin-bottom:3px;color:#333;">Amount Chargeable (in words):</div>';
  h += '<div style="font-size:10px;font-style:italic;margin-bottom:14px;">'+amountInWords(c.finalVal)+'</div>';

  h += '<div style="text-align:center;font-size:8px;color:#999;">Computer generated invoice  |  '+fmtDate(today())+'</div>';

  el.innerHTML = h;
  document.body.appendChild(el);

  html2canvas(el, {scale:2, useCORS:true, backgroundColor:'#ffffff'}).then(function(canvas){
    document.body.removeChild(el);
    canvas.toBlob(function(blob){
      if (mode === 'whatsapp') {
        shareToWhatsApp(blob, d);
      } else {
        var url=URL.createObjectURL(blob), a=document.createElement('a');
        a.href=url; a.download='Invoice_'+(d.invoiceNo||'draft')+'_'+d.date+'.jpg';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    },'image/jpeg',0.95);
  });
}

// ── WhatsApp Share ────────────────────────
$('shareWaBtn').addEventListener('click', function(){ generateJPG('whatsapp'); });

function shareToWhatsApp(blob, d) {
  var invNo = d.invoiceNo || 'draft';
  var file = new File([blob], 'Invoice_'+invNo+'_'+d.date+'.jpg', {type:'image/jpeg'});

  if (navigator.canShare && navigator.canShare({files:[file]})) {
    navigator.share({
      title: 'Invoice #'+invNo,
      text: 'Invoice #'+invNo+' for '+d.customer+' — Rs. '+fmt(computeSteps().finalVal),
      files: [file]
    }).catch(function(){
      fallbackWhatsApp(d);
    });
  } else {
    fallbackWhatsApp(d);
  }
}

function fallbackWhatsApp(d) {
  var invNo = d.invoiceNo || 'draft';
  var c = computeSteps();
  var text = 'Invoice #'+invNo+'\nCustomer: '+d.customer+'\nDate: '+fmtDate(d.date)+'\nTotal: Rs. '+fmt(c.finalVal);
  var url = 'https://wa.me/?text='+encodeURIComponent(text);
  window.open(url, '_blank');
}

// ── Init ──────────────────────────────────
$('billDate').value = today();
addItem();
addAdj();


