"use client";

import { useState } from "react";
import { CameraOnboarding } from "./CameraOnboarding";

const tips = [
  {
    icon: (
      <svg
        width="37"
        height="34"
        viewBox="0 0 37 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clipPath="url(#clip0_85_1932)">
          <path
            d="M18.5941 6.79842C19.2443 6.79842 19.7838 6.25887 19.7838 5.59481V2.62036C19.7838 1.9563 19.2443 1.41675 18.5941 1.41675C17.9301 1.41675 17.3905 1.9563 17.3905 2.62036V5.59481C17.3905 6.25887 17.9301 6.79842 18.5941 6.79842ZM25.3731 9.63452C25.8434 10.0911 26.6043 10.1049 27.0747 9.63452L29.1914 7.51782C29.6479 7.06129 29.6479 6.28654 29.1914 5.81616C28.7349 5.35961 27.9601 5.35961 27.5036 5.81616L25.3731 7.9467C24.9165 8.40324 24.9165 9.17798 25.3731 9.63452ZM28.1815 16.4273C28.1815 17.0776 28.7348 17.617 29.3851 17.617H32.3595C33.0098 17.617 33.5492 17.0776 33.5492 16.4273C33.5492 15.7771 33.0098 15.2237 32.3595 15.2237H29.3851C28.7348 15.2237 28.1815 15.7771 28.1815 16.4273ZM25.3731 23.2201C24.9165 23.6906 24.9165 24.4515 25.3731 24.9079L27.5036 27.0523C27.9601 27.5089 28.7349 27.4811 29.1914 27.0384C29.6479 26.5681 29.6479 25.8072 29.1914 25.3506L27.0609 23.2201C26.6043 22.7636 25.8434 22.7774 25.3731 23.2201ZM18.5941 26.0563C17.9301 26.0563 17.3905 26.5957 17.3905 27.246V30.2343C17.3905 30.8845 17.9301 31.424 18.5941 31.424C19.2443 31.424 19.7838 30.8845 19.7838 30.2343V27.246C19.7838 26.5957 19.2443 26.0563 18.5941 26.0563ZM11.8013 23.2201C11.3309 22.7774 10.5562 22.7636 10.0996 23.2201L7.98291 25.3369C7.52637 25.7933 7.52637 26.5542 7.96908 27.0247C8.42562 27.4674 9.21419 27.495 9.67074 27.0384L11.7874 24.9079C12.244 24.4515 12.244 23.6906 11.8013 23.2201ZM8.99284 16.4273C8.99284 15.7771 8.43946 15.2237 7.78922 15.2237H4.81478C4.16455 15.2237 3.625 15.7771 3.625 16.4273C3.625 17.0776 4.16455 17.617 4.81478 17.617H7.78922C8.43946 17.617 8.99284 17.0776 8.99284 16.4273ZM11.7874 9.63452C12.244 9.19181 12.244 8.38941 11.8013 7.9467L9.68457 5.81616C9.24186 5.37346 8.45328 5.35961 7.99675 5.81616C7.5402 6.28654 7.5402 7.06129 7.98291 7.50399L10.0996 9.63452C10.5562 10.0911 11.3171 10.0911 11.7874 9.63452Z"
            fill="#0E8BFF"
          />
          <path
            d="M18.5803 23.4691C22.468 23.4691 25.6222 20.3147 25.6222 16.4272C25.6222 12.5397 22.468 9.37158 18.5803 9.37158C14.6929 9.37158 11.5386 12.5397 11.5386 16.4272C11.5386 20.3147 14.6929 23.4691 18.5803 23.4691ZM18.5803 21.3662C15.8411 21.3662 13.6414 19.1665 13.6414 16.4272C13.6414 13.688 15.8411 11.4745 18.5803 11.4745C21.3196 11.4745 23.5194 13.688 23.5194 16.4272C23.5194 19.1665 21.3196 21.3662 18.5803 21.3662Z"
            fill="#0E8BFF"
          />
        </g>
        <defs>
          <clipPath id="clip0_85_1932">
            <rect
              width="30.4362"
              height="30.035"
              fill="white"
              transform="translate(3.625 1.41675)"
            />
          </clipPath>
        </defs>
      </svg>
    ),
    text: "Asegúrate de que haya suficiente iluminación.",
  },
  {
    icon: (
      <svg
        width="33"
        height="33"
        viewBox="0 0 33 33"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17.875 2.75H8.25C7.52065 2.75 6.82118 3.03973 6.30546 3.55546C5.78973 4.07118 5.5 4.77065 5.5 5.5V27.5C5.5 28.2293 5.78973 28.9288 6.30546 29.4445C6.82118 29.9603 7.52065 30.25 8.25 30.25H24.75C25.4793 30.25 26.1788 29.9603 26.6945 29.4445C27.2103 28.9288 27.5 28.2293 27.5 27.5V12.375L17.875 2.75Z"
          stroke="#0E8BFF"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17.875 2.75V12.375H27.5"
          stroke="#0E8BFF"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    text: "Evita dobleces en la hoja.",
  },
  {
    icon: (
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clipPath="url(#clip0_85_1946)">
          <path
            d="M14.7139 28.4599C22.1195 28.4599 27.7449 22.8488 27.7449 15.4431C27.7449 8.03751 22.1195 2.41211 14.7139 2.41211V28.4599ZM14.7139 29.9695C22.7319 29.9695 29.2403 23.4611 29.2403 15.4431C29.2403 7.42513 22.7319 0.916748 14.7139 0.916748C6.69588 0.916748 0.1875 7.42513 0.1875 15.4431C0.1875 23.4611 6.69588 29.9695 14.7139 29.9695ZM14.7139 27.5484C8.02034 27.5484 2.60857 22.1367 2.60857 15.4431C2.60857 8.74959 8.02034 3.33781 14.7139 3.33781C21.4074 3.33781 26.8191 8.74959 26.8191 15.4431C26.8191 22.1367 21.4074 27.5484 14.7139 27.5484Z"
            fill="#0E8BFF"
          />
        </g>
        <defs>
          <clipPath id="clip0_85_1946">
            <rect
              width="29.5797"
              height="29.0669"
              fill="white"
              transform="translate(0.1875 0.916748)"
            />
          </clipPath>
        </defs>
      </svg>
    ),
    text: "Evita sombras proyectadas sobre la hoja.",
  },
  {
    icon: (
      <svg
        width="35"
        height="34"
        viewBox="0 0 35 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M11.8333 4.25V8.5C11.8333 9.25145 11.5348 9.97212 11.0035 10.5035C10.4721 11.0348 9.75145 11.3333 9 11.3333H4.75M30.25 11.3333H26C25.2486 11.3333 24.5279 11.0348 23.9965 10.5035C23.4652 9.97212 23.1667 9.25145 23.1667 8.5V4.25M23.1667 29.75V25.5C23.1667 24.7486 23.4652 24.0279 23.9965 23.4965C24.5279 22.9652 25.2486 22.6667 26 22.6667H30.25M4.75 22.6667H9C9.75145 22.6667 10.4721 22.9652 11.0035 23.4965C11.5348 24.0279 11.8333 24.7486 11.8333 25.5V29.75"
          stroke="#0E8BFF"
          strokeWidth="2.83333"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    text: "Chequea la correcta inclinación de la hoja.",
  },
];

export function CameraInstructions() {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return <CameraOnboarding />;
  }

  return (
    <div className="h-full flex flex-col justify-between items-center bg-white py-safe">
      <div className="w-full pt-6 text-center flex flex-1 flex-col">
        <div className="text-lg font-medium flex justify-center">
          <h2 className="text-gray-900 text-lg"> Consejos para escanear</h2>
        </div>
        <div className="flex flex-col gap-9 flex-1 justify-center">
          {tips.map((tip, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="text-4xl text-blue-600 mb-2">{tip.icon}</div>
              <div className="text-base text-gray-900">{tip.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 w-full">
        <button
          onClick={() => setShowCamera(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg py-4 px-8 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-101 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50"
        >
          Comenzar
        </button>
      </div>
    </div>
  );
}
