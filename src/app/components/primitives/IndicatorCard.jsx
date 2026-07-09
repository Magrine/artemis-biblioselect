 const IndicatorCard =({ tone = "moon", title, value, description }) => {
  return (
    <div className="indicator-card">
      <div className={`indicator-card__header tone-${tone}`}>
        <span className="indicator-card__title">{title}</span>
      </div>

      <div className="indicator-card__body">
        <div className="indicator-card__value" style={{ textAlign: "center" }}>
          {value}
        </div>

        <div className="indicator-card__desc muted" style={{ textAlign: "center" }}>
          {description}
        </div>
      </div>
    </div>
  );
}

export default IndicatorCard;
