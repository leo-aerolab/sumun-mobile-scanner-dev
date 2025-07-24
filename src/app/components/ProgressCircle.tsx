const ProgressCircle: React.FC<{ percentage: number; large?: boolean }> = ({ percentage, large = false }) => {
    const size = large ? 150 : 100;
    const circleRadius = large ? 65 : 40;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const progress = (percentage / 100) * circleCircumference;
    return (
        <svg width={size} height={size} className="block">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={circleRadius}
                stroke="#E5E7EB"
                strokeWidth={large ? 12 : 8}
                fill="none"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={circleRadius}
                stroke="#1890ff"
                strokeWidth={large ? 12 : 8}
                fill="none"
                strokeDasharray={circleCircumference}
                strokeDashoffset={circleCircumference - progress}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s" }}
            />
            <text
                x="50%"
                y="54%"
                textAnchor="middle"
                className={large ? "fill-gray-900 text-3xl font-bold" : "fill-gray-900 text-2xl font-bold"}
                dominantBaseline="middle"
            >
                {percentage}%
            </text>
        </svg>
    );
};

export default ProgressCircle
