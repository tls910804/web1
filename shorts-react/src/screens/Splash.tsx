import { tt } from '../i18n';

export function Splash() {
  return (
    <section className="screen splash">
      <div className="logo">{tt('문')}</div>
      <h1>{tt('문장 쇼츠')}</h1>
      <p>{tt('한 문장씩 넘기며 배우는 외국어')}</p>
    </section>
  );
}
